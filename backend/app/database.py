from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,        # keep 5 persistent connections ready
    max_overflow=10,    # allow 10 extra connections under burst
    pool_recycle=300,   # recycle connections every 5 minutes to avoid stale pgbouncer sessions
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    },
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # MANDATORY: prevents DetachedInstanceError after commit in async context
)


async def init_db() -> None:
    """Create all tables from ORM metadata. Development only — production uses Alembic migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
