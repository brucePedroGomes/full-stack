#!/bin/sh
set -eu

# Scan an export: no Docker socket access, but extra disk space is needed.
# Fixed scanner version; update its digest regularly. The database updates on use.
trivy_image='aquasec/trivy:0.74.0@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969'
image_name=${1:-challenge-web}
scan_dir=$(mktemp -d)
trap 'rm -rf "$scan_dir"' EXIT

docker image save --output "$scan_dir/image.tar" "$image_name"
docker run --rm \
    --mount "type=bind,src=$scan_dir,dst=/scan,readonly" \
    --mount type=volume,source=challenge-trivy-cache,target=/root/.cache/trivy \
    "$trivy_image" image \
    --input /scan/image.tar \
    --scanners vuln \
    --severity HIGH,CRITICAL \
    --exit-code 1 \
    --no-progress
