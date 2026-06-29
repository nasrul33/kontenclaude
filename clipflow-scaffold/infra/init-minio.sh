#!/bin/sh
set -e
mc alias set local http://minio:9000 "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}"
mc mb --ignore-existing local/clipflow-sources
mc mb --ignore-existing local/clipflow-clips
mc mb --ignore-existing local/clipflow-srt
mc mb --ignore-existing local/clipflow-thumbnails
# Thumbnails are public-readable (for browser preview)
mc policy set download local/clipflow-thumbnails
echo "MinIO buckets initialized."
