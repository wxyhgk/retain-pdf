#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SERVICES_ROOT="$(python3 "${ROOT_DIR}/.github/scripts/resolve_backend_source.py" \
  --repo-root "${ROOT_DIR}" --print-path)"
VERSION_TAG="${1:-}"

if [[ -z "${VERSION_TAG}" ]]; then
  echo "usage: docker/release-images.sh <version-tag>"
  exit 1
fi

REGISTRY_USER="${REGISTRY_USER:-wxyhgk}"
APP_REPO="${APP_REPO:-${REGISTRY_USER}/retainpdf-app}"
WEB_REPO="${WEB_REPO:-${REGISTRY_USER}/retainpdf-web}"
TYPST_VERSION="${TYPST_VERSION:-0.14.2}"
PUSH_LATEST="${PUSH_LATEST:-1}"

export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-1}"

build_arg_flags=()
if [[ -n "${http_proxy:-}" ]]; then
  build_arg_flags+=(--build-arg "http_proxy=${http_proxy}")
fi
if [[ -n "${https_proxy:-}" ]]; then
  build_arg_flags+=(--build-arg "https_proxy=${https_proxy}")
fi
if [[ -n "${HTTP_PROXY:-}" ]]; then
  build_arg_flags+=(--build-arg "HTTP_PROXY=${HTTP_PROXY}")
fi
if [[ -n "${HTTPS_PROXY:-}" ]]; then
  build_arg_flags+=(--build-arg "HTTPS_PROXY=${HTTPS_PROXY}")
fi
if [[ -n "${ALL_PROXY:-}" ]]; then
  build_arg_flags+=(--build-arg "ALL_PROXY=${ALL_PROXY}")
fi

APP_VERSION_IMAGE="${APP_REPO}:${VERSION_TAG}"
WEB_VERSION_IMAGE="${WEB_REPO}:${VERSION_TAG}"
APP_LATEST_IMAGE="${APP_REPO}:latest"
WEB_LATEST_IMAGE="${WEB_REPO}:latest"

docker build \
  "${build_arg_flags[@]}" \
  --build-arg "TYPST_VERSION=${TYPST_VERSION}" \
  -f "${SERVICES_ROOT}/../ops/deployment/docker/backend/Dockerfile.app" \
  -t "${APP_VERSION_IMAGE}" \
  "${SERVICES_ROOT}/.."

docker build \
  "${build_arg_flags[@]}" \
  --build-arg "RETAIN_PDF_VERSION=${VERSION_TAG#v}" \
  -f "${ROOT_DIR}/ops/deployment/docker/Dockerfile.web" \
  -t "${WEB_VERSION_IMAGE}" \
  "${ROOT_DIR}"

if [[ "${PUSH_LATEST}" == "1" ]]; then
  docker tag "${APP_VERSION_IMAGE}" "${APP_LATEST_IMAGE}"
  docker tag "${WEB_VERSION_IMAGE}" "${WEB_LATEST_IMAGE}"
fi

docker push "${APP_VERSION_IMAGE}"
docker push "${WEB_VERSION_IMAGE}"

if [[ "${PUSH_LATEST}" == "1" ]]; then
  docker push "${APP_LATEST_IMAGE}"
  docker push "${WEB_LATEST_IMAGE}"
fi

echo "released ${APP_VERSION_IMAGE}"
echo "released ${WEB_VERSION_IMAGE}"
if [[ "${PUSH_LATEST}" == "1" ]]; then
  echo "released ${APP_LATEST_IMAGE}"
  echo "released ${WEB_LATEST_IMAGE}"
fi
