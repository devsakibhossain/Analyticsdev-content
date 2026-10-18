import asyncio
import logging
import signal
import sys
import redis

from app.config import get_settings
from app.jobs.scan_job import run_scan_job_task

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [worker] %(name)s: %(message)s"
)
logger = logging.getLogger("worker")
settings = get_settings()

running = True


def handle_exit(sig, frame):
    global running
    logger.info("Worker received shutdown signal. Exiting gracefully...")
    running = False


signal.signal(signal.SIGINT, handle_exit)
signal.signal(signal.SIGTERM, handle_exit)


async def main():
    logger.info(f"Worker started. Connecting to Redis: {settings.REDIS_URL}")
    r = redis.from_url(settings.REDIS_URL)

    while running:
        try:
            # Blocking pop with 2 second timeout to allow responsive shutdown
            item = r.brpop("leadfinder:scans", timeout=2)
            if item:
                _, scan_job_id_str = item
                scan_job_id = int(scan_job_id_str.decode("utf-8"))
                logger.info(f"Worker picked up scan job {scan_job_id}")
                await run_scan_job_task(scan_job_id)
        except redis.ConnectionError:
            logger.warning("Redis connection error in worker, retrying in 5 seconds...")
            await asyncio.sleep(5)
        except Exception as e:
            logger.error(f"Unexpected worker error: {e}", exc_info=True)
            await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(main())
