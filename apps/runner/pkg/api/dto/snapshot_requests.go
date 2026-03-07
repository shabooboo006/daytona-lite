// Copyright 2025 Daytona Platforms Inc.
// SPDX-License-Identifier: AGPL-3.0

package dto

type PullSnapshotRequestDTO struct {
	Snapshot            string       `json:"snapshot" validate:"required"`
	Registry            *RegistryDTO `json:"registry,omitempty"`
	DestinationRegistry *RegistryDTO `json:"destinationRegistry,omitempty"`
	DestinationRef      *string      `json:"destinationRef,omitempty"`
	NewTag              *string      `json:"newTag,omitempty"`
} // @name PullSnapshotRequestDTO

type BuildSnapshotRequestDTO struct {
	Snapshot               string        `json:"snapshot" validate:"required"`
	Dockerfile             string        `json:"dockerfile" validate:"required"`
	OrganizationId         string        `json:"organizationId" validate:"required"`
	Context                []string      `json:"context,omitempty"`
	Registry               *RegistryDTO  `json:"registry,omitempty"`
	SourceRegistries       []RegistryDTO `json:"sourceRegistries,omitempty"`
	PushToInternalRegistry bool          `json:"pushToInternalRegistry,omitempty"`
} // @name BuildSnapshotRequestDTO
