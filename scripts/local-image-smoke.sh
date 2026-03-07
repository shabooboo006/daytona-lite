#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
API_ENV_FILE="$ROOT_DIR/apps/api/.env"

if [ -f "$API_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$API_ENV_FILE"
  set +a
fi

API_PORT="${PORT:-3001}"
API_BASE_URL="${API_BASE_URL:-http://localhost:${API_PORT}/api}"
ADMIN_PASSWORD_VALUE="${ADMIN_PASSWORD:-}"
DEFAULT_RUNNER_API_KEY_VALUE="${DEFAULT_RUNNER_API_KEY:-}"
MINIMAL_IMAGE="alpine:3.20"
RUNNER_NAME="${SMOKE_RUNNER_NAME:-default}"

LAST_STATUS=""
LAST_RESPONSE=""
AUTH_TOKEN=""
ORG_ID=""
DEFAULT_REGION_ID=""
SNAPSHOT_ID=""
SNAPSHOT_NAME=""
SANDBOX_ID=""
SANDBOX_NAME=""
STAGE="init"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

json_query() {
  local expr="$1"

  node -e '
    const fs = require("fs");
    const expr = process.argv[1];
    const input = fs.readFileSync(0, "utf8");
    const data = JSON.parse(input);
    const value = Function("data", `return (${expr});`)(data);
    if (value === undefined || value === null) {
      process.exit(3);
    }
    if (typeof value === "object") {
      process.stdout.write(JSON.stringify(value));
      process.exit(0);
    }
    process.stdout.write(String(value));
  ' "$expr"
}

api_request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local organization_id="${4:-}"
  local tmp_file
  tmp_file="$(mktemp)"

  local -a curl_args=(
    -sS
    -o "$tmp_file"
    -w "%{http_code}"
    -X "$method"
    "$API_BASE_URL$path"
    -H "Accept: application/json"
  )

  if [ -n "$AUTH_TOKEN" ]; then
    curl_args+=(-H "Authorization: Bearer $AUTH_TOKEN")
  fi

  if [ -n "$organization_id" ]; then
    curl_args+=(-H "X-Daytona-Organization-ID: $organization_id")
  fi

  if [ -n "$body" ]; then
    curl_args+=(-H "Content-Type: application/json" --data "$body")
  fi

  LAST_STATUS="$(curl "${curl_args[@]}")"
  LAST_RESPONSE="$(cat "$tmp_file")"
  rm -f "$tmp_file"

  if [ "$LAST_STATUS" -lt 200 ] || [ "$LAST_STATUS" -ge 300 ]; then
    echo "API request failed during stage '$STAGE': $method $path (status $LAST_STATUS)" >&2
    echo "$LAST_RESPONSE" >&2
    exit 1
  fi

  printf '%s' "$LAST_RESPONSE"
}

cleanup() {
  if [ -z "$AUTH_TOKEN" ] || [ -z "$ORG_ID" ]; then
    return
  fi

  if [ -n "$SANDBOX_ID" ]; then
    curl -sS -X DELETE \
      "$API_BASE_URL/sandbox/$SANDBOX_ID" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "X-Daytona-Organization-ID: $ORG_ID" \
      -H "Accept: application/json" >/dev/null || true
  fi

  if [ -n "$SNAPSHOT_ID" ]; then
    curl -sS -X DELETE \
      "$API_BASE_URL/snapshots/$SNAPSHOT_ID" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "X-Daytona-Organization-ID: $ORG_ID" \
      -H "Accept: application/json" >/dev/null || true
  fi
}

trap cleanup EXIT

require_command docker
require_command curl
require_command node

if [ -z "$ADMIN_PASSWORD_VALUE" ]; then
  echo "ADMIN_PASSWORD is not set. Export it or populate apps/api/.env first." >&2
  exit 1
fi

if [ -z "$DEFAULT_RUNNER_API_KEY_VALUE" ]; then
  echo "DEFAULT_RUNNER_API_KEY is not set. Export it or populate apps/api/.env first." >&2
  exit 1
fi

echo "[1/8] Pulling minimal image: $MINIMAL_IMAGE"
STAGE="docker-pull"
if ! docker pull "$MINIMAL_IMAGE" >/dev/null; then
  if docker image inspect "$MINIMAL_IMAGE" >/dev/null 2>&1; then
    echo "docker pull failed, but $MINIMAL_IMAGE already exists locally; continuing" >&2
  else
    echo "docker pull failed and $MINIMAL_IMAGE is not available locally" >&2
    exit 1
  fi
fi

echo "[2/8] Logging in as admin"
STAGE="admin-login"
login_response="$(api_request POST "/admin/login" "{\"password\":\"$ADMIN_PASSWORD_VALUE\"}")"
AUTH_TOKEN="$(printf '%s' "$login_response" | json_query 'data.token')"

echo "[3/8] Resolving personal organization"
STAGE="list-organizations"
organizations_response="$(api_request GET "/organizations")"
ORG_ID="$(printf '%s' "$organizations_response" | json_query 'data.find((org) => org.personal)?.id')"
DEFAULT_REGION_ID="$(printf '%s' "$organizations_response" | json_query 'data.find((org) => org.personal)?.defaultRegionId ?? "default"')"

echo "[4/8] Waiting for default runner to become READY"
STAGE="wait-runner-ready"
runner_deadline=$((SECONDS + 180))
while true; do
  runner_response="$(
    curl -sS \
      -H "Accept: application/json" \
      -H "Authorization: Bearer $DEFAULT_RUNNER_API_KEY_VALUE" \
      "$API_BASE_URL/runners/me"
  )"
  runner_state="$(printf '%s' "$runner_response" | json_query 'data.state' || true)"
  runner_name="$(printf '%s' "$runner_response" | json_query 'data.name' || true)"
  if [ "$runner_state" = "ready" ]; then
    if [ "$runner_name" != "$RUNNER_NAME" ]; then
      echo "Runner API key resolved to '$runner_name', expected '$RUNNER_NAME'" >&2
      echo "$runner_response" >&2
      exit 1
    fi
    break
  fi

  if [ "$SECONDS" -ge "$runner_deadline" ]; then
    echo "Runner '$RUNNER_NAME' did not become READY within 180 seconds" >&2
    echo "$runner_response" >&2
    exit 1
  fi

  sleep 2
done

echo "[5/8] Waiting for local image scan to discover $MINIMAL_IMAGE"
STAGE="wait-local-image"
image_deadline=$((SECONDS + 180))
while true; do
  images_response="$(api_request GET "/snapshots/local-images?regionId=$DEFAULT_REGION_ID&q=alpine%3A3.20&refresh=true" "" "$ORG_ID")"
  has_image="$(printf '%s' "$images_response" | json_query 'data.some((image) => image.imageName === "alpine:3.20" || (image.repoTags || []).includes("alpine:3.20"))')"
  if [ "$has_image" = "true" ]; then
    break
  fi

  if [ "$SECONDS" -ge "$image_deadline" ]; then
    echo "Local image scan did not discover $MINIMAL_IMAGE within 180 seconds" >&2
    echo "$images_response" >&2
    exit 1
  fi

  sleep 2
done

SNAPSHOT_NAME="smoke-local-image-$(date +%s)"

echo "[6/8] Creating local-only snapshot: $SNAPSHOT_NAME"
STAGE="create-snapshot"
snapshot_response="$(api_request POST "/snapshots" "{\"name\":\"$SNAPSHOT_NAME\",\"imageName\":\"$MINIMAL_IMAGE\",\"regionId\":\"$DEFAULT_REGION_ID\"}" "$ORG_ID")"
SNAPSHOT_ID="$(printf '%s' "$snapshot_response" | json_query 'data.id')"
snapshot_state="$(printf '%s' "$snapshot_response" | json_query 'data.state')"
snapshot_source_type="$(printf '%s' "$snapshot_response" | json_query 'data.sourceType')"
snapshot_storage_mode="$(printf '%s' "$snapshot_response" | json_query 'data.storageMode')"

if [ "$snapshot_state" != "active" ] || [ "$snapshot_source_type" != "local_image" ] || [ "$snapshot_storage_mode" != "local_only" ]; then
  echo "Snapshot did not resolve to local_image/local_only/active" >&2
  echo "$snapshot_response" >&2
  exit 1
fi

SANDBOX_NAME="smoke-local-sandbox-$(date +%s)"

echo "[7/8] Creating sandbox and waiting for STARTED"
STAGE="create-sandbox"
sandbox_response="$(api_request POST "/sandbox" "{\"name\":\"$SANDBOX_NAME\",\"snapshot\":\"$SNAPSHOT_NAME\"}" "$ORG_ID")"
SANDBOX_ID="$(printf '%s' "$sandbox_response" | json_query 'data.id')"

STAGE="wait-sandbox-started"
sandbox_deadline=$((SECONDS + 180))
while true; do
  sandbox_response="$(api_request GET "/sandbox/$SANDBOX_ID" "" "$ORG_ID")"
  sandbox_state="$(printf '%s' "$sandbox_response" | json_query 'data.state')"
  if [ "$sandbox_state" = "started" ]; then
    break
  fi

  if [ "$sandbox_state" = "error" ]; then
    echo "Sandbox entered error state during startup" >&2
    echo "$sandbox_response" >&2
    exit 1
  fi

  if [ "$SECONDS" -ge "$sandbox_deadline" ]; then
    echo "Sandbox did not become STARTED within 180 seconds" >&2
    echo "$sandbox_response" >&2
    exit 1
  fi

  sleep 2
done

echo "[8/8] Executing smoke command, then stopping and deleting sandbox"
STAGE="execute-command"
execute_response="$(api_request POST "/toolbox/$SANDBOX_ID/toolbox/process/execute" "{\"command\":\"echo smoke-ok && cat /etc/os-release\",\"timeout\":20}" "$ORG_ID")"
exit_code="$(printf '%s' "$execute_response" | json_query 'data.exitCode')"
command_output="$(printf '%s' "$execute_response" | json_query 'data.result')"

if [ "$exit_code" != "0" ] || [[ "$command_output" != *"smoke-ok"* ]]; then
  echo "Smoke command failed" >&2
  echo "$execute_response" >&2
  exit 1
fi

STAGE="stop-sandbox"
api_request POST "/sandbox/$SANDBOX_ID/stop" "" "$ORG_ID" >/dev/null

STAGE="wait-sandbox-stopped"
stop_deadline=$((SECONDS + 120))
while true; do
  sandbox_response="$(api_request GET "/sandbox/$SANDBOX_ID" "" "$ORG_ID")"
  sandbox_state="$(printf '%s' "$sandbox_response" | json_query 'data.state')"
  if [ "$sandbox_state" = "stopped" ]; then
    break
  fi

  if [ "$SECONDS" -ge "$stop_deadline" ]; then
    echo "Sandbox did not stop within 120 seconds" >&2
    echo "$sandbox_response" >&2
    exit 1
  fi

  sleep 2
done

STAGE="delete-sandbox"
api_request DELETE "/sandbox/$SANDBOX_ID" "" "$ORG_ID" >/dev/null
SANDBOX_ID=""

STAGE="delete-snapshot"
api_request DELETE "/snapshots/$SNAPSHOT_ID" "" "$ORG_ID" >/dev/null
SNAPSHOT_ID=""

echo "Smoke flow succeeded."
