// Copyright 2025 Daytona Platforms Inc.
// SPDX-License-Identifier: AGPL-3.0

package daemon

import (
	"fmt"
	"strings"
)

func BinaryNameForDockerArchitecture(architecture string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(architecture)) {
	case "amd64", "x86_64":
		return "daemon-amd64", nil
	case "arm64", "aarch64", "arm64/v8":
		return "daemon-arm64", nil
	default:
		return "", fmt.Errorf("unsupported docker architecture for daemon binary: %s", architecture)
	}
}
