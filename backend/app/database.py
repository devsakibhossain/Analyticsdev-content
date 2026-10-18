import logging
from datetime import datetime, timezone
from typing import Generator
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import get_settings


def utc_now():
    return datetime.now(timezone.utc)

logger = logging.getLogger(__name__)
settings = get_settings()

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    echo=settings.DEBUG
)

# Enable SQLite foreign keys & WAL mode for high concurrency
if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency for obtaining a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Initialize database tables, indexes, and apply idempotent column migrations."""
    import app.models  # noqa: F401 - ensure all models are registered
    Base.metadata.create_all(bind=engine)

    # Safe SQLite column migration for existing databases
    if settings.DATABASE_URL.startswith("sqlite"):
        try:
            with engine.connect() as conn:
                result = conn.exec_driver_sql("PRAGMA table_info(leads);")
                columns = [row[1] for row in result.fetchall()]
                if "pipeline_stage" not in columns:
                    conn.exec_driver_sql("ALTER TABLE leads ADD COLUMN pipeline_stage VARCHAR(50) DEFAULT 'new';")
                    logger.info("Added pipeline_stage column to leads table.")
                if "ad_platforms" not in columns:
                    conn.exec_driver_sql("ALTER TABLE leads ADD COLUMN ad_platforms JSON DEFAULT '[]';")
                    logger.info("Added ad_platforms column to leads table.")

                # Migrate lead_emails table
                email_result = conn.exec_driver_sql("PRAGMA table_info(lead_emails);")
                email_cols = [row[1] for row in email_result.fetchall()]
                email_migrations = [
                    ("direction", "VARCHAR(20) DEFAULT 'outgoing'"),
                    ("in_reply_to", "VARCHAR(255)"),
                    ("thread_id", "VARCHAR(255)"),
                    ("tracking_token", "VARCHAR(64)"),
                    ("opened_at", "TIMESTAMP"),
                    ("last_opened_at", "TIMESTAMP"),
                    ("open_count", "INTEGER DEFAULT 0"),
                    ("user_agent", "VARCHAR(512)"),
                    ("ip_address", "VARCHAR(64)")
                ]
                for col_name, col_type in email_migrations:
                    if col_name not in email_cols:
                        conn.exec_driver_sql(f"ALTER TABLE lead_emails ADD COLUMN {col_name} {col_type};")
                        logger.info(f"Added {col_name} column to lead_emails table.")

                conn.commit()
        except Exception as e:
            logger.warning(f"SQLite migration check notice: {e}")

    logger.info("Database initialized successfully.")
