// Copyright 2025 Daytona Platforms Inc.
// SPDX-License-Identifier: AGPL-3.0

package dto

type LocalImageDTO struct {
	ImageName   string   `json:"imageName" example:"ubuntu:22.04"`
	RepoTags    []string `json:"repoTags,omitempty" example:"[\"ubuntu:22.04\"]"`
	RepoDigests []string `json:"repoDigests,omitempty" example:"[\"ubuntu@sha256:abc\"]"`
	SizeGB      float64  `json:"sizeGB" example:"0.13"`
	Entrypoint  []string `json:"entrypoint,omitempty" example:"[\"bash\"]"`
	Cmd         []string `json:"cmd,omitempty" example:"[\"-lc\",\"sleep infinity\"]"`
} // @name LocalImageDTO

type TagImageRequestDTO struct {
	SourceImage string `json:"sourceImage" binding:"required" example:"ubuntu:22.04"`
	TargetImage string `json:"targetImage" binding:"required" example:"registry.local/ubuntu:dev"`
} // @name TagImageRequestDTO
