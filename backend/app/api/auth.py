import logging
import secrets
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.core.rate_limit import rate_limit
from app.core.security import (
    validate_password_strength,
    log_login_attempt,
    get_trusted_client_ip,
    generate_secure_token
)

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# --- Account Lockout State ---
_lockout_lock = threading.Lock()
_login_attempts: Dict[str, Dict[str, Any]] = {}  # email -> {"count": int, "locked_until": datetime | None}

# --- Token Blacklist (JTI-based) ---
_blacklist_lock = threading.Lock()
_revoked_tokens: set = set()  # Set of revoked JTI values


# --- Cryptographic Helpers ---

def get_password_hash(password: str) -> str:
    """Hash password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate signed JWT token with JTI for revocation support."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "iat": now,
        "jti": secrets.token_hex(16)  # Unique token ID for revocation
    })
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate JWT token, checking blacklist."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        # Check if token has been revoked
        jti = payload.get("jti")
        if jti:
            with _blacklist_lock:
                if jti in _revoked_tokens:
                    return None
        return payload
    except jwt.PyJWTError:
        return None


def revoke_token(token: str):
    """Add a token's JTI to the blacklist."""
    try:
        # Decode without verification to get JTI for expired tokens too
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM], options={"verify_exp": False})
        jti = payload.get("jti")
        if jti:
            with _blacklist_lock:
                _revoked_tokens.add(jti)
                # Cleanup: limit blacklist size to prevent memory growth
                if len(_revoked_tokens) > 10000:
                    # Remove oldest entries (just clear and add current)
                    _revoked_tokens.clear()
                    _revoked_tokens.add(jti)
    except Exception:
        pass


# --- Account Lockout ---

def check_account_lockout(email: str) -> Optional[int]:
    """Check if account is locked. Returns remaining lockout seconds or None."""
    with _lockout_lock:
        record = _login_attempts.get(email)
        if not record:
            return None
        locked_until = record.get("locked_until")
        if locked_until and datetime.now(timezone.utc) < locked_until:
            remaining = int((locked_until - datetime.now(timezone.utc)).total_seconds())
            return max(1, remaining)
        return None


def record_failed_login(email: str):
    """Record a failed login attempt. Lock account after MAX_LOGIN_ATTEMPTS."""
    with _lockout_lock:
        if email not in _login_attempts:
            _login_attempts[email] = {"count": 0, "locked_until": None}
        _login_attempts[email]["count"] += 1
        if _login_attempts[email]["count"] >= settings.MAX_LOGIN_ATTEMPTS:
            _login_attempts[email]["locked_until"] = (
                datetime.now(timezone.utc) + timedelta(minutes=settings.ACCOUNT_LOCKOUT_MINUTES)
            )
            logger.warning(f"Account locked for {email} after {settings.MAX_LOGIN_ATTEMPTS} failed attempts.")


def reset_login_attempts(email: str):
    """Reset failed login counter on successful login."""
    with _lockout_lock:
        _login_attempts.pop(email, None)


# --- Seed Admin User ---

def seed_admin_user(db: Session) -> None:
    """Create default admin user if one does not exist."""
    # Validate SECRET_KEY in production
    if settings.APP_ENV == "production" and (
        not settings.SECRET_KEY or settings.SECRET_KEY.startswith("insecure") or settings.SECRET_KEY.startswith("dev_")
    ):
        raise RuntimeError(
            "CRITICAL: SECRET_KEY is insecure! Set a strong random SECRET_KEY in .env for production."
        )
    
    admin = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
    if not admin:
        admin_pwd = settings.ADMIN_PASSWORD
        if not admin_pwd:
            admin_pwd = secrets.token_urlsafe(24)
            logger.warning(f"No ADMIN_PASSWORD set. Generated random password for admin. Please set ADMIN_PASSWORD in .env")
        hashed_pwd = get_password_hash(admin_pwd)
        new_admin = User(
            email=settings.ADMIN_EMAIL,
            hashed_password=hashed_pwd,
            is_active=True
        )
        db.add(new_admin)
        db.commit()
        logger.info(f"Seeded admin user: {settings.ADMIN_EMAIL}")


# --- Dependency: Current User ---

async def get_current_user(
    request: Request,
    token_header: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Extract authenticated user from Bearer header or cookie."""
    token = token_header
    if not token:
        token = request.cookies.get("leadfinder_token")
        
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
        
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
        
    return user


# --- Schemas ---

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserResponse(BaseModel):
    id: int
    email: str
    is_active: bool

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# --- Routes ---

@router.post("/login", response_model=TokenResponse)
def login(
    login_data: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    _rate_limit: bool = Depends(rate_limit(max_requests=5, window_seconds=60.0))
):
    """Authenticate user with email and password, returning JWT and setting cookie."""
    client_ip = get_trusted_client_ip(request)
    user_agent = request.headers.get("user-agent", "unknown")[:200]
    email = login_data.email.lower().strip()
    
    # Check account lockout
    lockout_remaining = check_account_lockout(email)
    if lockout_remaining:
        log_login_attempt(email, client_ip, user_agent, False, f"Account locked ({lockout_remaining}s remaining)")
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account temporarily locked due to multiple failed login attempts. Try again in {lockout_remaining} seconds.",
            headers={"Retry-After": str(lockout_remaining)}
        )
    
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        record_failed_login(email)
        log_login_attempt(email, client_ip, user_agent, False, "Invalid credentials")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    if not user.is_active:
        log_login_attempt(email, client_ip, user_agent, False, "Account inactive")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    # Successful login - reset lockout counter
    reset_login_attempts(email)
    log_login_attempt(email, client_ip, user_agent, True)
    
    access_token = create_access_token({"sub": str(user.id), "email": user.email})
    
    # Set secure cookie
    response.set_cookie(
        key="leadfinder_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="strict",  # Changed from "lax" to "strict" for CSRF protection
        secure=(settings.APP_ENV == "production"),
        path="/"
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return current_user


@router.post("/logout")
def logout(request: Request, response: Response):
    """Log out by clearing authentication cookie and revoking token."""
    # Revoke the current token
    token = request.cookies.get("leadfinder_token")
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if token:
        revoke_token(token)
    
    response.delete_cookie(key="leadfinder_token", path="/")
    return {"message": "Logged out successfully"}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Change password for the current authenticated user with strength validation."""
    client_ip = get_trusted_client_ip(request)
    
    # Verify current password
    if not verify_password(payload.current_password, current_user.hashed_password):
        log_login_attempt(current_user.email, client_ip, "password-change", False, "Wrong current password")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    
    # Validate new password strength
    is_strong, reason = validate_password_strength(payload.new_password)
    if not is_strong:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=reason
        )
    
    # Prevent same password reuse
    if verify_password(payload.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password"
        )
    
    # Update password
    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    
    log_login_attempt(current_user.email, client_ip, "password-change", True, "Password changed successfully")
    logger.info(f"Password changed for user {current_user.email} from IP {client_ip}")
    
    return {"message": "Password changed successfully"}


@router.get("/security-status")
def get_security_status(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get security status including lockout info and session details."""
    client_ip = get_trusted_client_ip(request)
    email = current_user.email
    
    lockout_info = None
    with _lockout_lock:
        record = _login_attempts.get(email)
        if record:
            lockout_info = {
                "failed_attempts": record.get("count", 0),
                "max_attempts": settings.MAX_LOGIN_ATTEMPTS,
                "lockout_duration_minutes": settings.ACCOUNT_LOCKOUT_MINUTES
            }
    
    return {
        "email": email,
        "current_ip": client_ip,
        "session_timeout_minutes": settings.SESSION_INACTIVITY_MINUTES,
        "token_expiry_minutes": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        "lockout_info": lockout_info,
        "password_policy": {
            "min_length": settings.PASSWORD_MIN_LENGTH,
            "requires_uppercase": True,
            "requires_lowercase": True,
            "requires_digit": True,
            "requires_special_char": True
        },
        "security_features": [
            "Bcrypt password hashing (12 rounds)",
            "JWT token revocation on logout",
            "Account lockout after failed attempts",
            "IP-based rate limiting (spoof-resistant)",
            "HTTP-Only Secure Cookies (SameSite=Strict)",
            "Login audit logging",
            "Password strength enforcement",
            "HSTS enforcement in production",
            "CSP security headers"
        ]
    }
