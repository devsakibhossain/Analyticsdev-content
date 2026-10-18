from datetime import datetime, timezone
import logging
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
def health_check(db: Session = Depends(get_db)):
    """System health check endpoint for monitoring, Docker, and reverse proxies."""
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = "degraded"

    # Worker / queue health check
    worker_status = "ok"
    try:
        import redis
        r = redis.from_url(settings.REDIS_URL, socket_timeout=1)
        r.ping()
    except Exception:
        # If Redis is unavailable, fallback queue is active
        if settings.USE_IN_MEMORY_QUEUE_FALLBACK:
            worker_status = "in_memory_ready"
        else:
            worker_status = "degraded"

    overall_status = "ok" if db_status == "ok" else "error"

    return {
        "status": overall_status,
        "database": db_status,
        "worker": worker_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
