import logging
import asyncio
from datetime import datetime, timezone
from app.database import SessionLocal, utc_now
from app.models.scan_job import ScanJob
from app.models.scan_error import ScanError
from app.models.crawl_page import CrawlPage
from app.models.lead import Lead
from app.crawler.crawler import WebsiteCrawler, CrawlReport

logger = logging.getLogger(__name__)


async def run_scan_job_task(scan_job_id: int):
    """Execute a scan job asynchronously."""
    with SessionLocal() as db:
        job = db.query(ScanJob).filter(ScanJob.id == scan_job_id).first()
        if not job:
            logger.error(f"Scan job {scan_job_id} not found")
            return

        if job.status == "cancelled":
            logger.info(f"Scan job {scan_job_id} was cancelled before starting")
            return

        job.status = "running"
        job.started_at = utc_now()
        job.progress = 5
        job.current_step = "Initializing crawler"
        db.commit()

        target_url = job.target_url
        max_pages = job.max_pages
        use_sitemap = job.use_sitemap
        scan_js = job.scan_js

    async def progress_callback(pct: int, desc: str):
        with SessionLocal() as db_inner:
            j = db_inner.query(ScanJob).filter(ScanJob.id == scan_job_id).first()
            if j and j.status != "cancelled":
                j.progress = pct
                j.current_step = desc
                db_inner.commit()

    try:
        crawler = WebsiteCrawler(
            max_pages=max_pages,
            use_sitemap=use_sitemap,
            scan_js=scan_js,
            crawl_delay=1.0,
            progress_callback=progress_callback
        )

        report: CrawlReport = await crawler.crawl(target_url)

        with SessionLocal() as db:
            j = db.query(ScanJob).filter(ScanJob.id == scan_job_id).first()
            if not j:
                return

            if j.status == "cancelled":
                logger.info(f"Scan job {scan_job_id} was cancelled during crawl")
                return

            j.current_step = "Processing extracted data & analyzing tracking"
            j.progress = 75
            j.pages_crawled = report.pages_crawled
            j.pages_failed = report.pages_failed
            db.commit()

            # Record scan errors
            for err in report.errors:
                scan_err = ScanError(
                    scan_id=j.id,
                    url=err.url,
                    error_type=err.error_type,
                    error_message=err.error_message
                )
                db.add(scan_err)

            # Record crawled pages
            for page in report.pages:
                crawl_page = CrawlPage(
                    scan_id=j.id,
                    url=page.url,
                    status_code=page.status_code,
                    title=page.title,
                    page_type=page.page_type,
                    load_time_ms=page.load_time_ms
                )
                db.add(crawl_page)

            # Create or update Lead record
            lead = db.query(Lead).filter(Lead.domain == report.domain).first()
            if not lead:
                lead = Lead(
                    domain=report.domain,
                    website_url=report.root_url,
                    company_name=report.domain,
                    website_title=report.pages[0].title if report.pages else report.domain,
                    pages_crawled=report.pages_crawled
                )
                db.add(lead)
                db.flush()
            else:
                lead.website_url = report.root_url
                lead.pages_crawled = report.pages_crawled
                if report.pages and not lead.website_title:
                    lead.website_title = report.pages[0].title

            j.lead_id = lead.id

            # Associate crawl pages with lead
            for p in db.query(CrawlPage).filter(CrawlPage.scan_id == j.id).all():
                p.lead_id = lead.id

            # Execute full extraction & detection pipeline if pages were crawled
            if report.pages:
                try:
                    from app.jobs.pipeline import process_lead_pipeline
                    process_lead_pipeline(db, lead, report)
                except ImportError:
                    # Pipeline being built in Phase 3-6
                    pass
                except Exception as ex:
                    logger.error(f"Error in extraction pipeline for lead {lead.id}: {ex}", exc_info=True)

            j.status = "completed"
            j.progress = 100
            j.current_step = "Completed"
            j.completed_at = utc_now()
            db.commit()
            logger.info(f"Scan job {scan_job_id} successfully completed for domain {report.domain}")

    except Exception as e:
        logger.error(f"Scan job {scan_job_id} failed with error: {e}", exc_info=True)
        with SessionLocal() as db:
            j = db.query(ScanJob).filter(ScanJob.id == scan_job_id).first()
            if j:
                j.status = "failed"
                j.error_message = str(e)
                j.completed_at = utc_now()
                db.commit()
