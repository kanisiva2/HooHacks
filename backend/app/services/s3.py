"""
S3 artifact storage helpers.
Functions: upload_bytes, upload_text, get_presigned_url, and key helpers.
Uses aioboto3 — never boto3 (synchronous boto3 blocks the event loop).
"""

import logging

import aioboto3

from app.config import settings

logger = logging.getLogger(__name__)


def _session() -> aioboto3.Session:
    return aioboto3.Session(
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
    )


def _bucket() -> str:
    return settings.s3_bucket_name


# ---------------------------------------------------------------------------
# Key helpers
# ---------------------------------------------------------------------------

def incident_audio_key(incident_id: str) -> str:
    return f"incidents/{incident_id}/audio.webm"


def incident_transcript_key(incident_id: str) -> str:
    return f"incidents/{incident_id}/transcript.txt"


def incident_report_key(incident_id: str) -> str:
    return f"incidents/{incident_id}/report.md"


# ---------------------------------------------------------------------------
# Upload / download
# ---------------------------------------------------------------------------

async def upload_bytes(key: str, data: bytes, content_type: str) -> None:
    """Upload raw bytes to S3."""
    session = _session()
    async with session.client("s3") as s3:
        await s3.put_object(
            Bucket=_bucket(),
            Key=key,
            Body=data,
            ContentType=content_type,
        )
    logger.info("Uploaded %d bytes to s3://%s/%s", len(data), _bucket(), key)


async def upload_text(key: str, text: str) -> None:
    """Convenience wrapper — uploads UTF-8 text as text/plain."""
    await upload_bytes(key, text.encode("utf-8"), "text/plain")


async def get_presigned_url(key: str, expires_in: int = 3600) -> str:
    """Generate a temporary pre-signed download URL (default 1-hour expiry)."""
    session = _session()
    async with session.client("s3") as s3:
        url = await s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": _bucket(), "Key": key},
            ExpiresIn=expires_in,
        )
    return url
