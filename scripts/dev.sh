#!/usr/bin/env bash

# Copyright 2025 Daytona Platforms Inc.
# SPDX-License-Identifier: AGPL-3.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.dev.yml"
API_ENV_EXAMPLE="$ROOT_DIR/apps/api/.env.example"
API_ENV_FILE="$ROOT_DIR/apps/api/.env"
NODE_MODULES_DIR="$ROOT_DIR/node_modules"
NX_BIN="$NODE_MODULES_DIR/.bin/nx"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOCKER_COMPOSE_BIN=""
DOCKER_COMPOSE_SUBCMD=""
HOST_OS=""
HOST_ARCH=""
DOCKER_OS=""
DOCKER_ARCH=""
DOCKER_PLATFORM=""
DOCKER_CONTEXT=""
ROSETTA_TRANSLATED=""
EFFECTIVE_DOCKER_DEFAULT_PLATFORM=""
TEMP_COMPOSE_OVERRIDE_FILE=""
FALLBACK_SERVICES=()
FALLBACK_PLATFORMS=()
FALLBACK_IMAGES=()
RUNNER_DEV_MODE="${RUNNER_DEV_MODE:-prebuilt}"
RUNNER_PREBUILT_IMAGE="${DAYTONA_DEV_RUNNER_IMAGE:-daytonaio/daytona-runner:latest}"

log_info() {
  printf "%b\n" "${BLUE}[INFO]${NC} $1"
}

log_success() {
  printf "%b\n" "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
  printf "%b\n" "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  printf "%b\n" "${RED}[ERROR]${NC} $1"
}

cleanup_runtime_artifacts() {
  if [ -n "${TEMP_COMPOSE_OVERRIDE_FILE:-}" ] && [ -f "$TEMP_COMPOSE_OVERRIDE_FILE" ]; then
    rm -f "$TEMP_COMPOSE_OVERRIDE_FILE"
  fi
  TEMP_COMPOSE_OVERRIDE_FILE=""
}

trap cleanup_runtime_artifacts EXIT

normalize_os() {
  case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
    darwin)
      echo "darwin"
      ;;
    linux)
      echo "linux"
      ;;
    *)
      printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
      ;;
  esac
}

normalize_arch() {
  case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
    amd64|x86_64)
      echo "amd64"
      ;;
    arm64|aarch64|arm64/v8)
      echo "arm64"
      ;;
    *)
      printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
      ;;
  esac
}

csv_contains() {
  local csv="$1"
  local needle="$2"

  case ",$csv," in
    *",$needle,"*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

append_csv_value() {
  local csv="$1"
  local value="$2"

  if [ -z "$value" ]; then
    echo "$csv"
    return 0
  fi

  if [ -z "$csv" ]; then
    echo "$value"
    return 0
  fi

  if csv_contains "$csv" "$value"; then
    echo "$csv"
  else
    echo "$csv,$value"
  fi
}

compose_engine_label() {
  if [ "$DOCKER_COMPOSE_BIN" = "docker" ]; then
    echo "docker compose"
  else
    echo "docker-compose"
  fi
}

service_profile() {
  case "$1" in
    registry|registry-ui)
      echo "registry"
      ;;
    *)
      echo ""
      ;;
  esac
}

service_image() {
  case "$1" in
    db)
      echo "postgres:18"
      ;;
    redis)
      echo "redis:7-alpine"
      ;;
    minio)
      echo "minio/minio:latest"
      ;;
    registry)
      echo "registry:2.8.2"
      ;;
    registry-ui)
      echo "joxit/docker-registry-ui:main"
      ;;
    *)
      return 1
      ;;
  esac
}

service_enabled() {
  local service="$1"
  local active_profiles_csv="$2"
  local required_profile

  required_profile="$(service_profile "$service")"
  if [ -z "$required_profile" ]; then
    return 0
  fi

  csv_contains "$active_profiles_csv" "$required_profile"
}

collect_active_profiles_csv() {
  local profiles_csv=""
  local profile_name
  local previous_ifs

  while [ $# -gt 0 ]; do
    case "$1" in
      --tools)
        profiles_csv="$(append_csv_value "$profiles_csv" "tools")"
        ;;
      --observability)
        profiles_csv="$(append_csv_value "$profiles_csv" "observability")"
        ;;
      --full)
        profiles_csv="$(append_csv_value "$profiles_csv" "tools")"
        profiles_csv="$(append_csv_value "$profiles_csv" "observability")"
        ;;
    esac
    shift
  done

  if [ -n "${COMPOSE_PROFILES:-}" ]; then
    previous_ifs="$IFS"
    IFS=','
    for profile_name in ${COMPOSE_PROFILES}; do
      profile_name="$(printf '%s' "$profile_name" | tr -d '[:space:]')"
      profiles_csv="$(append_csv_value "$profiles_csv" "$profile_name")"
    done
    IFS="$previous_ifs"
  fi

  echo "$profiles_csv"
}

detect_host_platform() {
  HOST_OS="$(normalize_os "$(uname -s 2>/dev/null || echo unknown)")"
  HOST_ARCH="$(normalize_arch "$(uname -m 2>/dev/null || echo unknown)")"
}

detect_rosetta_status() {
  ROSETTA_TRANSLATED=""

  if [ "${HOST_OS:-}" != "darwin" ] || ! command -v sysctl >/dev/null 2>&1; then
    return 0
  fi

  ROSETTA_TRANSLATED="$(sysctl -in sysctl.proc_translated 2>/dev/null || true)"
}

detect_docker_platform() {
  local docker_version
  local docker_os
  local docker_arch

  DOCKER_CONTEXT="$(docker context show 2>/dev/null || echo "unknown")"
  docker_version="$(docker version --format '{{.Server.Os}} {{.Server.Arch}}' 2>/dev/null || true)"
  if [ -z "$docker_version" ]; then
    docker_version="$(docker info --format '{{.OSType}} {{.Architecture}}' 2>/dev/null || true)"
  fi

  docker_os="$(printf '%s' "$docker_version" | awk '{print $1}')"
  docker_arch="$(printf '%s' "$docker_version" | awk '{print $2}')"

  if [ -z "$docker_os" ] || [ -z "$docker_arch" ]; then
    DOCKER_OS=""
    DOCKER_ARCH=""
    DOCKER_PLATFORM=""
    EFFECTIVE_DOCKER_DEFAULT_PLATFORM=""
    return 1
  fi

  DOCKER_OS="$(normalize_os "$docker_os")"
  DOCKER_ARCH="$(normalize_arch "$docker_arch")"
  DOCKER_PLATFORM="${DOCKER_OS}/${DOCKER_ARCH}"
  EFFECTIVE_DOCKER_DEFAULT_PLATFORM="$DOCKER_PLATFORM"
}

inspect_local_image_platform() {
  docker image inspect "$1" --format '{{.Os}}/{{.Architecture}}' 2>/dev/null || true
}

remote_image_supports_platform() {
  local image="$1"
  local platform="$2"
  local os="${platform%%/*}"
  local arch="${platform##*/}"
  local manifest

  manifest="$(docker manifest inspect "$image" 2>/dev/null | tr -d '[:space:]' || true)"
  if [ -z "$manifest" ]; then
    return 1
  fi

  if printf '%s' "$manifest" | grep -Eq "\"platform\":\\{\"architecture\":\"${arch}\"[^}]*\"os\":\"${os}\""; then
    return 0
  fi

  if printf '%s' "$manifest" | grep -Eq "\"platform\":\\{\"os\":\"${os}\"[^}]*\"architecture\":\"${arch}\""; then
    return 0
  fi

  if printf '%s' "$manifest" | grep -Eq "\"architecture\":\"${arch}\"[^}]*\"os\":\"${os}\""; then
    return 0
  fi

  if printf '%s' "$manifest" | grep -Eq "\"os\":\"${os}\"[^}]*\"architecture\":\"${arch}\""; then
    return 0
  fi

  return 1
}

record_service_fallback() {
  local service="$1"
  local platform="$2"
  local image="$3"
  local idx

  for idx in "${!FALLBACK_SERVICES[@]}"; do
    if [ "${FALLBACK_SERVICES[$idx]}" = "$service" ]; then
      FALLBACK_PLATFORMS[$idx]="$platform"
      FALLBACK_IMAGES[$idx]="$image"
      return 0
    fi
  done

  FALLBACK_SERVICES+=("$service")
  FALLBACK_PLATFORMS+=("$platform")
  FALLBACK_IMAGES+=("$image")
}

write_platform_override_file() {
  local idx

  cleanup_runtime_artifacts
  TEMP_COMPOSE_OVERRIDE_FILE="$(mktemp "${TMPDIR:-/tmp}/daytona-dev-platform.XXXXXX.yml")"

  {
    echo "services:"
    for idx in "${!FALLBACK_SERVICES[@]}"; do
      echo "  ${FALLBACK_SERVICES[$idx]}:"
      echo "    platform: ${FALLBACK_PLATFORMS[$idx]}"
    done

    if [ "${RUNNER_DEV_MODE}" = "local" ]; then
      echo "  runner:"
      echo "    image: daytona-lite-runner-dev"
      echo "    build:"
      echo "      context: ${ROOT_DIR}"
      echo "      dockerfile: ${ROOT_DIR}/apps/runner/Dockerfile"
    fi
  } >"$TEMP_COMPOSE_OVERRIDE_FILE"
}

normalize_runner_dev_mode() {
  case "$(printf '%s' "$RUNNER_DEV_MODE" | tr '[:upper:]' '[:lower:]')" in
    ""|prebuilt|remote)
      RUNNER_DEV_MODE="prebuilt"
      ;;
    local)
      RUNNER_DEV_MODE="local"
      ;;
    *)
      log_error "不支持的 RUNNER_DEV_MODE=${RUNNER_DEV_MODE}，可选值为 prebuilt 或 local"
      exit 1
      ;;
  esac
}

ensure_node_toolchain() {
  if ! command -v node >/dev/null 2>&1; then
    log_error "Node.js 未安装，请先安装 Node.js"
    exit 1
  fi

  if ! command -v yarn >/dev/null 2>&1; then
    log_error "Yarn 未安装，请先安装 Yarn"
    exit 1
  fi
}

ensure_js_dependencies() {
  ensure_node_toolchain

  if [ -x "$NX_BIN" ]; then
    return 0
  fi

  log_warn "检测到前端/Node 依赖未安装，正在自动执行 yarn install ..."
  (
    cd "$ROOT_DIR"
    yarn install
  )
  log_success "依赖安装完成"
}

get_dashboard_port() {
  echo "3000"
}

is_port_in_use() {
  local port="$1"

  if ! command -v lsof >/dev/null 2>&1; then
    return 1
  fi

  lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

ensure_port_available() {
  local port="$1"
  local service_name="$2"

  if ! is_port_in_use "$port"; then
    return 0
  fi

  local pid
  pid="$(lsof -tiTCP:"$port" -sTCP:LISTEN | head -n 1 || true)"
  if [ -n "$pid" ]; then
    log_error "${service_name} 需要的端口 ${port} 已被占用（PID: ${pid}）。请先停止占用进程后重试。"
  else
    log_error "${service_name} 需要的端口 ${port} 已被占用，请先释放该端口后重试。"
  fi
  exit 1
}

wait_for_http_ready() {
  local url="$1"
  local label="$2"
  local timeout_seconds="${3:-120}"
  local watched_pid="${4:-}"

  if ! command -v curl >/dev/null 2>&1; then
    log_warn "未检测到 curl，跳过 ${label} 就绪探测。"
    return 0
  fi

  local start_time
  start_time="$(date +%s)"

  while true; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log_success "${label} 已就绪: ${url}"
      return 0
    fi

    if [ -n "$watched_pid" ] && ! kill -0 "$watched_pid" >/dev/null 2>&1; then
      log_error "${label} 在就绪前已退出，请检查上方日志。"
      return 1
    fi

    local now
    now="$(date +%s)"
    if [ $((now - start_time)) -ge "$timeout_seconds" ]; then
      log_error "等待 ${label} 就绪超时（${timeout_seconds}s）: ${url}"
      return 1
    fi

    sleep 1
  done
}

wait_for_process_exit() {
  local pid="$1"
  local label="$2"

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    log_error "${label} 提前退出，请检查上方日志。"
    return 1
  fi

  return 0
}

detect_compose_cmd() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_BIN="docker"
    DOCKER_COMPOSE_SUBCMD="compose"
    return 0
  fi

  if command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_BIN="docker-compose"
    DOCKER_COMPOSE_SUBCMD=""
    return 0
  fi

  return 1
}

compose_cmd() {
  local compose_files=(-f "$COMPOSE_FILE")

  if [ -n "${TEMP_COMPOSE_OVERRIDE_FILE:-}" ] && [ -f "$TEMP_COMPOSE_OVERRIDE_FILE" ]; then
    compose_files+=(-f "$TEMP_COMPOSE_OVERRIDE_FILE")
  fi

  if [ "$DOCKER_COMPOSE_BIN" = "docker" ]; then
    DOCKER_DEFAULT_PLATFORM="${EFFECTIVE_DOCKER_DEFAULT_PLATFORM:-${DOCKER_DEFAULT_PLATFORM:-}}" \
      DAYTONA_DEV_RUNNER_IMAGE="${RUNNER_PREBUILT_IMAGE}" \
      docker compose "${compose_files[@]}" "$@"
  else
    DOCKER_DEFAULT_PLATFORM="${EFFECTIVE_DOCKER_DEFAULT_PLATFORM:-${DOCKER_DEFAULT_PLATFORM:-}}" \
      DAYTONA_DEV_RUNNER_IMAGE="${RUNNER_PREBUILT_IMAGE}" \
      docker-compose "${compose_files[@]}" "$@"
  fi
}

ensure_runtime() {
  if ! command -v docker >/dev/null 2>&1; then
    log_error "Docker 未安装，请先安装 Docker Desktop"
    exit 1
  fi

  if ! detect_compose_cmd; then
    log_error "未检测到 docker compose 或 docker-compose"
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    log_error "Docker 未启动，请先启动 Docker Desktop"
    exit 1
  fi
}

ensure_api_env() {
  if [ -f "$API_ENV_FILE" ]; then
    return 0
  fi

  if [ ! -f "$API_ENV_EXAMPLE" ]; then
    log_error "缺少模板文件: $API_ENV_EXAMPLE"
    exit 1
  fi

  cp "$API_ENV_EXAMPLE" "$API_ENV_FILE"
  log_warn "检测到 apps/api/.env 不存在，已从 .env.example 自动生成。"
  log_warn "请按需修改 ADMIN_PASSWORD、ENCRYPTION_KEY、ENCRYPTION_SALT 等配置。"
}

get_api_port() {
  if [ ! -f "$API_ENV_FILE" ]; then
    echo "3001"
    return 0
  fi

  local port
  port="$(grep -E '^PORT=' "$API_ENV_FILE" | tail -n 1 | cut -d '=' -f2- || true)"
  if [ -z "$port" ]; then
    echo "3001"
  else
    echo "$port"
  fi
}

get_api_env_value() {
  local key="$1"
  local default_value="${2:-}"

  if [ ! -f "$API_ENV_FILE" ]; then
    echo "$default_value"
    return 0
  fi

  local value
  value="$(grep -E "^${key}=" "$API_ENV_FILE" | tail -n 1 | cut -d '=' -f2- || true)"
  if [ -z "$value" ]; then
    echo "$default_value"
  else
    echo "$value"
  fi
}

log_platform_context() {
  local host_summary="${HOST_OS:-unknown}/${HOST_ARCH:-unknown}"
  local docker_summary="${DOCKER_PLATFORM:-unknown}"
  local message="Host platform: ${host_summary}, Docker runtime platform: ${docker_summary}"

  if [ -n "${DOCKER_CONTEXT:-}" ]; then
    message="${message}, Context: ${DOCKER_CONTEXT}"
  fi

  if [ "${HOST_OS:-}" = "darwin" ]; then
    case "${ROSETTA_TRANSLATED:-}" in
      1)
        message="${message}, Shell: rosetta"
        ;;
      0)
        message="${message}, Shell: native"
        ;;
    esac
  fi

  log_info "$message"

  if [ "${HOST_OS:-}" = "darwin" ] && [ "${HOST_ARCH:-}" = "arm64" ] && [ "${DOCKER_PLATFORM:-}" = "linux/arm64" ]; then
    log_info "检测到 macOS ARM 宿主机，API / Dashboard 将在本机运行，Docker Desktop Linux runtime 将承载开发容器。"
  fi

  if [ -n "${DOCKER_DEFAULT_PLATFORM:-}" ] && [ "${DOCKER_DEFAULT_PLATFORM}" != "${EFFECTIVE_DOCKER_DEFAULT_PLATFORM:-}" ]; then
    log_warn "检测到 DOCKER_DEFAULT_PLATFORM=${DOCKER_DEFAULT_PLATFORM}，本地开发脚本将覆盖为 ${EFFECTIVE_DOCKER_DEFAULT_PLATFORM}"
  elif [ -n "${DOCKER_DEFAULT_PLATFORM:-}" ]; then
    log_info "DOCKER_DEFAULT_PLATFORM=${DOCKER_DEFAULT_PLATFORM}"
  fi
}

ensure_prebuilt_runner_image() {
  local image="$1"
  local current_platform

  if ! remote_image_supports_platform "$image" "$DOCKER_PLATFORM"; then
    log_error "预构建 Runner 镜像 ${image} 不支持 ${DOCKER_PLATFORM}。请改用 RUNNER_DEV_MODE=local 或更换镜像。"
    return 1
  fi

  current_platform="$(inspect_local_image_platform "$image")"
  if [ -n "$current_platform" ] && [ "$current_platform" = "$DOCKER_PLATFORM" ]; then
    log_info "预构建 Runner 镜像已就绪: ${image} (${current_platform})"
    return 0
  fi

  if [ -n "$current_platform" ]; then
    log_info "Refreshing prebuilt Runner image ${image} from ${current_platform} to ${DOCKER_PLATFORM}"
    docker image rm "$image" >/dev/null 2>&1 || true
  else
    log_info "Pulling prebuilt Runner image ${image} for ${DOCKER_PLATFORM}"
  fi

  if docker pull --platform "$DOCKER_PLATFORM" "$image" >/dev/null 2>&1; then
    current_platform="$(inspect_local_image_platform "$image")"
    if [ "$current_platform" = "$DOCKER_PLATFORM" ]; then
      return 0
    fi
  fi

  log_error "无法为当前平台准备预构建 Runner 镜像 ${image}"
  return 1
}

prepare_external_image() {
  local service="$1"
  local image="$2"
  local desired_platform="$3"
  local fallback_platform="linux/amd64"
  local current_platform
  local pulled_platform

  current_platform="$(inspect_local_image_platform "$image")"
  if [ -n "$current_platform" ] && [ "$current_platform" = "$desired_platform" ]; then
    return 0
  fi

  if [ -n "$current_platform" ]; then
    log_info "Repairing cached image ${image} from ${current_platform} to ${desired_platform}"
    docker image rm "$image" >/dev/null 2>&1 || true
  else
    log_info "Pulling ${image} for ${desired_platform}"
  fi

  if docker pull --platform "$desired_platform" "$image" >/dev/null 2>&1; then
    pulled_platform="$(inspect_local_image_platform "$image")"
    if [ "$pulled_platform" = "$desired_platform" ]; then
      return 0
    fi

    log_error "镜像 ${image} 拉取后平台异常：期望 ${desired_platform}，实际 ${pulled_platform:-unknown}"
    return 1
  fi

  if [ "$desired_platform" != "$fallback_platform" ] \
    && ! remote_image_supports_platform "$image" "$desired_platform" \
    && remote_image_supports_platform "$image" "$fallback_platform"; then
    log_warn "Falling back ${image} to ${fallback_platform} (native ${desired_platform} unavailable)"
    docker image rm "$image" >/dev/null 2>&1 || true

    if docker pull --platform "$fallback_platform" "$image" >/dev/null 2>&1; then
      pulled_platform="$(inspect_local_image_platform "$image")"
      if [ "$pulled_platform" != "$fallback_platform" ]; then
        log_error "镜像 ${image} 回退后平台异常：期望 ${fallback_platform}，实际 ${pulled_platform:-unknown}"
        return 1
      fi

      record_service_fallback "$service" "$fallback_platform" "$image"
      return 0
    fi
  fi

  log_error "无法为 ${service} 准备镜像 ${image}（目标平台 ${desired_platform}）。请检查网络、镜像仓库权限或镜像平台支持情况。"
  return 1
}

run_platform_preflight() {
  local active_profiles_csv="$1"
  local external_services=(db redis minio registry registry-ui)
  local service
  local image

  FALLBACK_SERVICES=()
  FALLBACK_PLATFORMS=()
  FALLBACK_IMAGES=()
  cleanup_runtime_artifacts
  normalize_runner_dev_mode

  log_info "环境探测..."
  detect_host_platform
  detect_rosetta_status
  if ! detect_docker_platform; then
    log_error "无法探测 Docker 平台，请确认 Docker Desktop 运行正常。"
    exit 1
  fi
  log_platform_context

  if [ "${HOST_OS:-}" = "darwin" ]; then
    log_info "development mode: ${HOST_OS}/${HOST_ARCH} host + Docker Desktop runtime"
  else
    log_info "development mode: ${HOST_OS}/${HOST_ARCH} host + Docker runtime ${DOCKER_PLATFORM}"
  fi
  log_info "镜像纠偏..."

  for service in "${external_services[@]}"; do
    if ! service_enabled "$service" "$active_profiles_csv"; then
      continue
    fi

    image="$(service_image "$service")"
    if ! prepare_external_image "$service" "$image" "$DOCKER_PLATFORM"; then
      exit 1
    fi
  done

  if [ "${RUNNER_DEV_MODE}" = "prebuilt" ]; then
    if ! ensure_prebuilt_runner_image "${RUNNER_PREBUILT_IMAGE}"; then
      exit 1
    fi
  else
    log_info "Runner mode: local source build"
  fi

  if [ ${#FALLBACK_SERVICES[@]} -gt 0 ] || [ "${RUNNER_DEV_MODE}" = "local" ]; then
    write_platform_override_file
  fi

  log_success "平台预检完成"
}

start_services() {
  ensure_runtime
  ensure_api_env

  local profiles=()
  local active_profiles_csv
  active_profiles_csv="$(collect_active_profiles_csv "$@")"

  while [ $# -gt 0 ]; do
    case "$1" in
      --tools)
        profiles+=(--profile tools)
        ;;
      --observability)
        profiles+=(--profile observability)
        ;;
      --full)
        profiles+=(--profile tools --profile observability)
        ;;
      *)
        log_warn "忽略未知参数: $1"
        ;;
    esac
    shift
  done

  run_platform_preflight "$active_profiles_csv"

  local runner_api_key
  runner_api_key="$(get_api_env_value "DEFAULT_RUNNER_API_KEY" "local_runner_key")"

  if [ "${RUNNER_DEV_MODE}" = "local" ]; then
    log_info "构建本地 Runner 开发镜像..."
    DEFAULT_RUNNER_API_KEY="$runner_api_key" compose_cmd build runner
  else
    log_info "使用预构建 Runner 镜像: ${RUNNER_PREBUILT_IMAGE}"
  fi

  log_info "启动开发基础设施（docker-compose.dev.yml）..."
  if [ ${#profiles[@]} -gt 0 ]; then
    DEFAULT_RUNNER_API_KEY="$runner_api_key" compose_cmd up -d "${profiles[@]}"
  else
    DEFAULT_RUNNER_API_KEY="$runner_api_key" compose_cmd up -d
  fi
  log_success "基础设施已启动"

  local api_port
  api_port="$(get_api_port)"

  echo
  log_info "常用地址:"
  echo "  - API（本机启动后）: http://localhost:${api_port}"
  echo "  - Dashboard（本机启动后）: http://localhost:3000"
  echo "  - Runner API: http://localhost:3003"
  echo "  - PostgreSQL: localhost:5432"
  echo "  - Redis: localhost:6379"
  echo "  - MinIO API: http://localhost:9000"
  echo "  - MinIO Console: http://localhost:9001"
  echo "  - Registry: http://localhost:6000"
  echo
  log_info "下一步:"
  echo "  - 启动 API: yarn dev:api"
  echo "  - 启动 Dashboard: yarn dev:dashboard"
  echo "  - 一键启动本机应用: yarn dev"
}

stop_services() {
  ensure_runtime

  log_info "停止开发基础设施..."
  compose_cmd down
  log_success "开发基础设施已停止"
}

reset_services() {
  ensure_runtime

  log_warn "重置开发基础设施，将删除 docker-compose.dev.yml 对应 volumes ..."
  compose_cmd down -v
  log_success "开发基础设施 volumes 已删除"

  start_services "$@"
}

restart_services() {
  stop_services
  start_services "$@"
}

show_status() {
  ensure_runtime
  compose_cmd ps
}

show_logs() {
  ensure_runtime
  compose_cmd logs -f "$@"
}

run_doctor() {
  local has_issue=false
  local active_profiles_csv=""
  local external_services=(db redis minio registry registry-ui)
  local service
  local image
  local cached_platform
  local note

  echo "[doctor] 检查基础环境"
  normalize_runner_dev_mode

  if command -v docker >/dev/null 2>&1; then
    echo "  - docker: $(docker --version)"
  else
    echo "  - docker: missing"
    has_issue=true
  fi

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    detect_compose_cmd
    echo "  - compose: $(docker compose version | head -n 1)"
  elif command -v docker-compose >/dev/null 2>&1; then
    detect_compose_cmd
    echo "  - compose: $(docker-compose --version)"
  else
    echo "  - compose: missing"
    has_issue=true
  fi

  if command -v node >/dev/null 2>&1; then
    echo "  - node: $(node --version)"
  else
    echo "  - node: missing"
    has_issue=true
  fi

  if command -v yarn >/dev/null 2>&1; then
    echo "  - yarn: $(yarn --version)"
  else
    echo "  - yarn: missing"
    has_issue=true
  fi

  if [ -x "$NX_BIN" ]; then
    echo "  - node_modules: present"
  else
    echo "  - node_modules: missing (可由 yarn dev 自动安装)"
  fi

  if [ -f "$API_ENV_FILE" ]; then
    echo "  - apps/api/.env: present"
  else
    echo "  - apps/api/.env: missing (将使用 .env.example 自动生成)"
  fi

  if [ -f "$SCRIPT_DIR/setup-proxy-dns.sh" ]; then
    echo "  - proxy dns script: scripts/setup-proxy-dns.sh"
  else
    echo "  - proxy dns script: missing"
  fi

  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    detect_host_platform
    detect_rosetta_status
    normalize_runner_dev_mode
    if detect_docker_platform; then
      echo "  - host platform: ${HOST_OS}/${HOST_ARCH}"
      echo "  - docker runtime platform: ${DOCKER_PLATFORM}"
      echo "  - docker context: ${DOCKER_CONTEXT}"
      if [ "${HOST_OS:-}" = "darwin" ] && [ "${HOST_ARCH:-}" = "arm64" ] && [ "${DOCKER_PLATFORM:-}" = "linux/arm64" ]; then
        echo "  - development mode: macOS ARM host + Docker Desktop runtime"
      else
        echo "  - development mode: ${HOST_OS}/${HOST_ARCH} host + Docker runtime"
      fi
      if [ "${HOST_OS:-}" = "darwin" ]; then
        case "${ROSETTA_TRANSLATED:-}" in
          1)
            echo "  - rosetta shell: yes"
            ;;
          0)
            echo "  - rosetta shell: no"
            ;;
        esac
      fi
    else
      echo "  - docker platform: unavailable"
      has_issue=true
    fi
  elif command -v docker >/dev/null 2>&1; then
    echo "  - docker daemon: unavailable"
    has_issue=true
  fi

  if [ -n "${DOCKER_DEFAULT_PLATFORM:-}" ]; then
    echo "  - DOCKER_DEFAULT_PLATFORM: ${DOCKER_DEFAULT_PLATFORM}"
  else
    echo "  - DOCKER_DEFAULT_PLATFORM: unset"
  fi

  if [ -n "$DOCKER_COMPOSE_BIN" ]; then
    echo "  - compose engine: $(compose_engine_label)"
  fi
  echo "  - runner mode: ${RUNNER_DEV_MODE}"
  if [ "${RUNNER_DEV_MODE}" = "prebuilt" ]; then
    echo "  - runner image: ${RUNNER_PREBUILT_IMAGE}"
    if [ -n "${DOCKER_PLATFORM:-}" ]; then
      if remote_image_supports_platform "${RUNNER_PREBUILT_IMAGE}" "${DOCKER_PLATFORM}"; then
        echo "  - runner image support: ${DOCKER_PLATFORM}"
      else
        echo "  - runner image support: missing ${DOCKER_PLATFORM}"
        has_issue=true
      fi
    fi
  else
    echo "  - runner image: daytona-lite-runner-dev (local build)"
  fi

  active_profiles_csv="$(collect_active_profiles_csv)"
  echo "  - image cache:"
  for service in "${external_services[@]}"; do
    image="$(service_image "$service")"
    note=""

    if ! service_enabled "$service" "$active_profiles_csv"; then
      note=" (inactive profile: $(service_profile "$service"))"
    fi

    cached_platform="$(inspect_local_image_platform "$image")"
    if [ -z "$cached_platform" ]; then
      echo "    - ${image}: not cached${note}"
      continue
    fi

    if [ -n "${DOCKER_PLATFORM:-}" ] && [ "$cached_platform" != "$DOCKER_PLATFORM" ] && service_enabled "$service" "$active_profiles_csv"; then
      echo "    - ${image}: mismatch ${cached_platform} -> expected ${DOCKER_PLATFORM}${note}"
      has_issue=true
    else
      echo "    - ${image}: ${cached_platform}${note}"
    fi
  done

  if [ "$has_issue" = true ]; then
    log_warn "检测到缺失项或平台问题，建议先修复后再运行开发命令。"
    return 1
  fi

  log_success "基础环境检查完成"
}

ensure_api_database() {
  local db_name="${DB_DATABASE:-daytona}"
  local db_user="${DB_USERNAME:-user}"

  if ! detect_compose_cmd; then
    return 0
  fi

  if ! docker info >/dev/null 2>&1; then
    return 0
  fi

  if ! compose_cmd ps --services --status running | grep -qx "db"; then
    log_warn "PostgreSQL 容器未运行，跳过数据库自动检查。"
    return 0
  fi

  local exists
  exists="$(
    compose_cmd exec -T db psql -U "$db_user" -d postgres \
      -tAc "SELECT 1 FROM pg_database WHERE datname='${db_name}';" 2>/dev/null \
      | tr -d '[:space:]' || true
  )"

  if [ "$exists" = "1" ]; then
    return 0
  fi

  log_warn "检测到数据库 '$db_name' 不存在，正在自动创建..."
  if compose_cmd exec -T db psql -U "$db_user" -d postgres -c "CREATE DATABASE \"$db_name\";" >/dev/null 2>&1; then
    log_success "数据库 '$db_name' 创建完成"
  else
    log_warn "自动创建数据库 '$db_name' 失败，请手动检查 PostgreSQL 权限或数据库名。"
  fi
}

run_api() {
  ensure_js_dependencies
  ensure_api_env

  set -a
  # shellcheck disable=SC1090
  source "$API_ENV_FILE"
  set +a

  if [ "${DB_HOST:-}" = "db" ] || [ -z "${DB_HOST:-}" ]; then
    export DB_HOST="localhost"
  fi
  if [ "${REDIS_HOST:-}" = "redis" ] || [ -z "${REDIS_HOST:-}" ]; then
    export REDIS_HOST="localhost"
  fi
  if [[ "${S3_ENDPOINT:-}" == *"minio:9000"* ]] || [ -z "${S3_ENDPOINT:-}" ]; then
    export S3_ENDPOINT="http://localhost:9000"
  fi
  if [[ "${S3_STS_ENDPOINT:-}" == *"minio:9000"* ]] || [ -z "${S3_STS_ENDPOINT:-}" ]; then
    export S3_STS_ENDPOINT="http://localhost:9000/minio/v1/assume-role"
  fi
  if [[ "${DEFAULT_RUNNER_DOMAIN:-}" == *"runner"* ]] || [ -z "${DEFAULT_RUNNER_DOMAIN:-}" ]; then
    export DEFAULT_RUNNER_DOMAIN="localhost:3003"
  fi
  if [[ "${DEFAULT_RUNNER_API_URL:-}" == *"runner"* ]] || [ -z "${DEFAULT_RUNNER_API_URL:-}" ]; then
    export DEFAULT_RUNNER_API_URL="http://localhost:3003"
  fi
  if [[ "${DEFAULT_RUNNER_PROXY_URL:-}" == *"runner"* ]] || [ -z "${DEFAULT_RUNNER_PROXY_URL:-}" ]; then
    export DEFAULT_RUNNER_PROXY_URL="http://localhost:3003"
  fi
  if [ -z "${DEFAULT_RUNNER_DOCKER_MODE:-}" ]; then
    export DEFAULT_RUNNER_DOCKER_MODE="host"
  fi
  if [ "${DASHBOARD_BASE_API_URL:-}" = "http://localhost:3000" ]; then
    export DASHBOARD_BASE_API_URL="http://localhost:${PORT:-3001}"
  fi
  export NX_TUI="false"
  export NX_DAEMON="false"

  ensure_api_database

  cd "$ROOT_DIR"
  exec yarn nx serve api --configuration=development --output-style=stream
}

run_dashboard() {
  ensure_js_dependencies
  cd "$ROOT_DIR"
  export NX_TUI="false"
  export NX_DAEMON="false"
  exec yarn nx serve dashboard --output-style=stream
}

run_full() {
  ensure_js_dependencies
  start_services

  local api_port
  local dashboard_port
  api_port="$(get_api_port)"
  dashboard_port="$(get_dashboard_port)"

  ensure_port_available "$api_port" "API"
  ensure_port_available "$dashboard_port" "Dashboard"

  log_info "启动本机 API 与 Dashboard（Ctrl+C 结束）..."

  (
    cd "$ROOT_DIR"
    ./scripts/dev.sh api
  ) &
  local api_pid=$!
  local dashboard_pid=""

  cleanup() {
    kill "$api_pid" >/dev/null 2>&1 || true
    if [ -n "${dashboard_pid:-}" ]; then
      kill "$dashboard_pid" >/dev/null 2>&1 || true
    fi
    cleanup_runtime_artifacts
  }

  trap cleanup INT TERM EXIT

  if ! wait_for_process_exit "$api_pid" "API"; then
    exit 1
  fi

  log_info "等待 API 就绪..."
  if ! wait_for_http_ready "http://localhost:${api_port}/api/config" "API" 180 "$api_pid"; then
    exit 1
  fi

  (
    cd "$ROOT_DIR"
    ./scripts/dev.sh dashboard
  ) &
  dashboard_pid=$!

  if ! wait_for_process_exit "$dashboard_pid" "Dashboard"; then
    exit 1
  fi

  log_info "等待 Dashboard 就绪..."
  if ! wait_for_http_ready "http://localhost:${dashboard_port}/" "Dashboard" 120 "$dashboard_pid"; then
    exit 1
  fi

  wait "$api_pid" "$dashboard_pid"
}

show_help() {
  cat <<USAGE
Daytona Lite 本地开发脚本

用法:
  ./scripts/dev.sh <command> [options]

命令:
  start [--tools|--observability|--full]  启动开发基础设施
  reset [--tools|--observability|--full]  删除开发 volumes 并重新初始化基础设施
  stop                                    停止开发基础设施
  restart [--tools|--observability|--full] 重启开发基础设施
  status                                  查看容器状态
  logs [service]                          查看日志
  doctor                                  检查本地开发环境
  api                                     本机启动 API（热重载）
  dashboard                               本机启动 Dashboard（Vite）
  full                                    启动基础设施 + API + Dashboard
  help                                    显示帮助

常用:
  yarn dev
  yarn dev:start
  yarn dev:runner-local
  yarn dev:reset
  yarn dev:api
  yarn dev:dashboard
USAGE
}

CMD="${1:-help}"
shift || true

case "$CMD" in
  start)
    start_services "$@"
    ;;
  reset)
    reset_services "$@"
    ;;
  stop)
    stop_services
    ;;
  restart)
    restart_services "$@"
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs "$@"
    ;;
  doctor)
    run_doctor
    ;;
  api)
    run_api
    ;;
  dashboard)
    run_dashboard
    ;;
  full)
    run_full
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    log_error "未知命令: $CMD"
    show_help
    exit 1
    ;;
esac
