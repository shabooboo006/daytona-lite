// Copyright 2025 Daytona Platforms Inc.
// SPDX-License-Identifier: AGPL-3.0

package docker

import (
	"fmt"
	"strings"

	v1 "github.com/opencontainers/image-spec/specs-go/v1"
)

func normalizeDockerArchitecture(architecture string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(architecture)) {
	case "amd64", "x86_64":
		return "amd64", nil
	case "arm64", "aarch64", "arm64/v8":
		return "arm64", nil
	default:
		return "", fmt.Errorf("unsupported docker architecture: %s", architecture)
	}
}

func normalizeDockerOS(os string) string {
	normalized := strings.ToLower(strings.TrimSpace(os))
	if normalized == "" {
		return "linux"
	}

	return normalized
}

func (d *DockerClient) containerPlatform() *v1.Platform {
	return &v1.Platform{
		Architecture: d.platformArchitecture,
		OS:           d.platformOS,
	}
}

func (d *DockerClient) imagePlatform() string {
	return fmt.Sprintf("%s/%s", d.platformOS, d.platformArchitecture)
}
