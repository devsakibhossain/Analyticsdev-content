import asyncio
import logging
import threading
from typing import Optional
from fastapi import BackgroundTasks
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class JobQueue:
    """Queue abstraction supporting Redis with background task fallback."""

    def __init__(self):
        self._redis_client = None
        self._initialized = False

    def _init_redis(self):
        if not self._initialized:
            try:
                import redis
                r = redis.from_url(settings.REDIS_URL, socket_timeout=1)
                r.ping()
                self._redis_client = r
                logger.info("Connected to Redis queue broker.")
            except Exception as e:
                logger.info(f"Redis unavailable ({e}), using async background thread worker.")
                self._redis_client = None
            self._initialized = True

    def enqueue_scan(self, scan_job_id: int, background_tasks: Optional[BackgroundTasks] = None):
        """Enqueue a scan job ID to be processed."""
        self._init_redis()
        if self._redis_client:
            try:
                self._redis_client.lpush("leadfinder:scans", str(scan_job_id))
                logger.info(f"Enqueued scan job {scan_job_id} to Redis")
                return
            except Exception as e:
                logger.warning(f"Failed to push to Redis ({e}), falling back to background runner.")

        # Threaded background worker running asyncio loop
        from app.jobs.scan_job import run_scan_job_task

        def run_in_thread():
            asyncio.run(run_scan_job_task(scan_job_id))

        if background_tasks:
            background_tasks.add_task(run_in_thread)
            logger.info(f"Scheduled scan job {scan_job_id} via FastAPI BackgroundTasks")
        else:
            thread = threading.Thread(target=run_in_thread, daemon=True)
            thread.start()
            logger.info(f"Spawned daemon thread for scan job {scan_job_id}")


queue_manager = JobQueue()
