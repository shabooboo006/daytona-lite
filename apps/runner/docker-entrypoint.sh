#!/bin/sh
set -eu

MODE="${RUNNER_DOCKER_MODE:-host}"

if [ "$MODE" = "dind" ]; then
  if [ -n "${RUNNER_INSECURE_REGISTRIES:-}" ]; then
    mkdir -p /etc/docker

    JSON_ENTRIES=""
    OLD_IFS="$IFS"
    IFS=','
    for registry in $RUNNER_INSECURE_REGISTRIES; do
      registry=$(echo "$registry" | xargs)
      if [ -z "$registry" ]; then
        continue
      fi
      if [ -n "$JSON_ENTRIES" ]; then
        JSON_ENTRIES="$JSON_ENTRIES, "
      fi
      JSON_ENTRIES="$JSON_ENTRIES\"$registry\""
    done
    IFS="$OLD_IFS"

    if [ -n "$JSON_ENTRIES" ]; then
      printf '{"insecure-registries":[%s]}\n' "$JSON_ENTRIES" > /etc/docker/daemon.json
    fi
  fi

  /usr/local/bin/dockerd-entrypoint.sh &
fi

exec daytona-runner
