#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODELS_DIR="${BACKEND_DIR}/src/models"
REGISTRY_FILE="${BACKEND_DIR}/src/db/jsonSchemaValidators.ts"

if [[ ! -d "${MODELS_DIR}" ]]; then
  echo "check-minor-field-registry: models dir missing at ${MODELS_DIR}" >&2
  exit 2
fi

if [[ ! -f "${REGISTRY_FILE}" ]]; then
  echo "check-minor-field-registry: registry file missing at ${REGISTRY_FILE}" >&2
  exit 2
fi

declared_fields=$(
  grep -rhoE '^[[:space:]]+[A-Za-z_][A-Za-z0-9_]*Minor:[[:space:]]*\{' "${MODELS_DIR}" \
    | sed -E 's/^[[:space:]]+//; s/:[[:space:]]*\{$//' \
    | sort -u
)

if [[ -z "${declared_fields}" ]]; then
  echo "check-minor-field-registry: no *Minor field declarations found under ${MODELS_DIR}" >&2
  exit 2
fi

missing=()
while IFS= read -r field; do
  [[ -z "${field}" ]] && continue
  if ! grep -qE "\"${field}\"" "${REGISTRY_FILE}"; then
    missing+=("${field}")
  fi
done <<< "${declared_fields}"

if (( ${#missing[@]} > 0 )); then
  echo "check-minor-field-registry: the following *Minor fields appear in src/models/ but are missing from ${REGISTRY_FILE}:" >&2
  for f in "${missing[@]}"; do
    echo "  - ${f}" >&2
  done
  exit 1
fi

echo "check-minor-field-registry: OK — every *Minor field in src/models/ is present in jsonSchemaValidators.ts"
