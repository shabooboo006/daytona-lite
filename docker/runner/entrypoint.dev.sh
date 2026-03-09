#!/bin/sh
set -eu

wait_for_docker() {
  attempts="${1:-60}"

  while [ "$attempts" -gt 0 ]; do
    if docker info >/dev/null 2>&1; then
      return 0
    fi

    attempts=$((attempts - 1))
    sleep 1
  done

  return 1
}

if [ -S /var/run/docker.sock ]; then
  echo "Using host Docker socket"

  if ! wait_for_docker 60; then
    echo "Host Docker daemon is not ready" >&2
    exit 1
  fi

  exec daytona-runner
fi

echo "Starting Docker-in-Docker daemon"
/usr/local/bin/dockerd-entrypoint.sh >/tmp/dockerd.log 2>&1 &

if ! wait_for_docker 90; then
  cat /tmp/dockerd.log >&2 || true
  echo "Docker-in-Docker daemon did not become ready" >&2
  exit 1
fi

exec daytona-runner
