// Copyright 2025 Daytona Platforms Inc.
// SPDX-License-Identifier: AGPL-3.0

package docker

import (
	"context"
	"strings"

	"github.com/daytonaio/runner/pkg/api/dto"
	"github.com/docker/docker/api/types/image"
)

func (d *DockerClient) ListLocalImages(ctx context.Context, query string) ([]dto.LocalImageDTO, error) {
	images, err := d.apiClient.ImageList(ctx, image.ListOptions{All: true})
	if err != nil {
		return nil, err
	}

	query = strings.TrimSpace(strings.ToLower(query))
	result := make([]dto.LocalImageDTO, 0, len(images))
	for _, img := range images {
		if !matchesImageQuery(img.RepoTags, img.RepoDigests, query) {
			continue
		}

		imageName := imageNameFromRefs(img.RepoTags, img.RepoDigests, img.ID)
		info, err := d.GetImageInfo(ctx, imageName)
		if err != nil {
			d.logger.WarnContext(ctx, "Failed to inspect local image", "imageName", imageName, "error", err)
			info = &ImageInfo{Size: img.Size}
		}

		result = append(result, dto.LocalImageDTO{
			ImageName:   imageName,
			RepoTags:    filterDanglingRefs(img.RepoTags),
			RepoDigests: img.RepoDigests,
			SizeGB:      float64(info.Size) / (1024 * 1024 * 1024),
			Entrypoint:  info.Entrypoint,
			Cmd:         info.Cmd,
		})
	}

	return result, nil
}

func matchesImageQuery(repoTags []string, repoDigests []string, query string) bool {
	if query == "" {
		return true
	}

	for _, ref := range append(filterDanglingRefs(repoTags), repoDigests...) {
		if strings.Contains(strings.ToLower(ref), query) {
			return true
		}
	}

	return false
}

func imageNameFromRefs(repoTags []string, repoDigests []string, fallback string) string {
	tags := filterDanglingRefs(repoTags)
	if len(tags) > 0 {
		return tags[0]
	}
	if len(repoDigests) > 0 {
		return repoDigests[0]
	}
	return fallback
}

func filterDanglingRefs(refs []string) []string {
	filtered := make([]string, 0, len(refs))
	for _, ref := range refs {
		if ref == "" || strings.HasSuffix(ref, "<none>:<none>") {
			continue
		}
		filtered = append(filtered, ref)
	}
	return filtered
}
