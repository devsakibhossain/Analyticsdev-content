import logging
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response, JSONResponse

from app.config import get_settings
from app.database import init_db, SessionLocal
from app.api.auth import router as auth_router, seed_admin_user
from app.api.health import router as health_router
from app.api.scans import router as scans_router
from app.api.leads import router as leads_router
from app.api.opportunities import router as opportunities_router
from app.api.stats import router as stats_router
from app.api.exports import router as exports_router
from app.api.emails import router as emails_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("app.main")
settings = get_settings()

MAX_REQUEST_BODY_SIZE = 5 * 1024 * 1024  # 5 MB


class MaxBodySizeMiddleware(BaseHTTPMiddleware):
    """Reject requests exceeding max body size, including chunked transfers."""
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_REQUEST_BODY_SIZE:
                    return JSONResponse(
                        status_code=413,
                        content={"detail": "Payload too large. Maximum allowed size is 5MB."}
                    )
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid Content-Length header."}
                )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Inject comprehensive security headers on every response."""
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        )
        if settings.APP_ENV == "production":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        return response


class ExceptionRedactionMiddleware(BaseHTTPMiddleware):
    """Catch unhandled exceptions and return sanitized error responses in production."""
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as exc:
            logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
            if settings.APP_ENV != "production":
                return JSONResponse(
                    status_code=500,
                    content={"detail": str(exc), "traceback": traceback.format_exc()}
                )
            return JSONResponse(
                status_code=500,
                content={"detail": "An internal server error occurred. Please try again later."}
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables and seed admin user
    logger.info("Initializing database...")
    init_db()
    with SessionLocal() as db:
        seed_admin_user(db)
    logger.info("Application startup complete.")
    yield
    # Shutdown
    logger.info("Application shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    description="CRM Ultra - Enterprise Lead Intelligence, Cold Outreach & Sales CRM Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.APP_ENV != "production" else None,
    redoc_url="/api/redoc" if settings.APP_ENV != "production" else None,
)

# Middleware stack (order matters - outermost first)
app.add_middleware(ExceptionRedactionMiddleware)
app.add_middleware(MaxBodySizeMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# CORS configuration - strict in production
if settings.APP_ENV == "production":
    origins = [settings.FRONTEND_URL]
else:
    origins = list(set([
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ] + settings.CORS_ORIGINS))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)

# API Routers
app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(scans_router, prefix="/api")
app.include_router(leads_router, prefix="/api")
app.include_router(opportunities_router, prefix="/api")
app.include_router(stats_router, prefix="/api")
app.include_router(exports_router, prefix="/api")
app.include_router(emails_router, prefix="/api")


@app.get("/")
def root():
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "health": "/api/health",
        "docs": "/api/docs" if settings.APP_ENV != "production" else "disabled in production"
    }
