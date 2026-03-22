from fastapi import APIRouter

# E1 owns this router. Implemented in Sprint 2.
# Endpoints: GET /api/incidents/{id}/artifacts — returns pre-signed S3 URLs
router = APIRouter()
