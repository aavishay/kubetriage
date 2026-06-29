package gitops

import (
	"time"
)

// AppResource represents a single Kubernetes resource managed by an ArgoCD Application
type AppResource struct {
	Group           string `json:"group,omitempty"`
	Kind            string `json:"kind"`
	Namespace       string `json:"namespace,omitempty"`
	Name            string `json:"name"`
	SyncStatus      string `json:"syncStatus"`
	HealthStatus    string `json:"healthStatus"`
	Action          string `json:"action,omitempty"`       // ArgoCD sync action: unchanged, configured, created, pruned
	Message         string `json:"message,omitempty"`
	RequiresPruning bool   `json:"requiresPruning,omitempty"`
}

// GitOpsResource represents a unified view of an ArgoCD Application or Flux resource
type GitOpsResource struct {
	Tool              string            `json:"tool"` // "ArgoCD" or "Flux"
	Kind              string            `json:"kind"` // "Application", "Kustomization", "HelmRelease", "GitRepository"
	Name              string            `json:"name"`
	Namespace         string            `json:"namespace"`
	SyncStatus        string            `json:"syncStatus"`   // "Synced", "OutOfSync", "Unknown"
	HealthStatus      string            `json:"healthStatus"` // "Healthy", "Degraded", "Progressing", "Suspended", "Unknown"
	LastSyncTime      time.Time         `json:"lastSyncTime"`
	Revision          string            `json:"revision"`
	SourceURL         string            `json:"sourceUrl"`
	Message           string            `json:"message"`
	Conditions        []GitOpsCondition `json:"conditions"`
	ResourceCount     int               `json:"resourceCount"`
	ReadyResources    int               `json:"readyResources"`
	SyncErrors        []string          `json:"syncErrors,omitempty"`
	Misconfigurations []string          `json:"misconfigurations,omitempty"`
	Resources         []AppResource     `json:"resources,omitempty"`
}

// GitOpsCondition represents a status condition on a GitOps resource
type GitOpsCondition struct {
	Type               string    `json:"type"`
	Status             string    `json:"status"`
	Reason             string    `json:"reason,omitempty"`
	Message            string    `json:"message,omitempty"`
	LastTransitionTime time.Time `json:"lastTransitionTime,omitempty"`
}

// Summary aggregates status across all GitOps resources
type Summary struct {
	Total       int `json:"total"`
	Synced      int `json:"synced"`
	OutOfSync   int `json:"outOfSync"`
	Degraded    int `json:"degraded"`
	Progressing int `json:"progressing"`
	Suspended   int `json:"suspended"`
	Unknown     int `json:"unknown"`
}

// StatusResponse is the top-level API response
type StatusResponse struct {
	ClusterID string           `json:"clusterId"`
	Timestamp time.Time        `json:"timestamp"`
	ArgoCD    []GitOpsResource `json:"argocd"`
	Flux      []GitOpsResource `json:"flux"`
	Summary   Summary          `json:"summary"`
}

// ResourceDiffEntry represents a single Kubernetes resource inside an ArgoCD
// Application diff. It reports the ArgoCD sync action (configured, unchanged,
// created, pruned, etc.) rather than a full YAML diff.
type ResourceDiffEntry struct {
	Group           string `json:"group,omitempty"`
	Kind            string `json:"kind"`
	Namespace       string `json:"namespace,omitempty"`
	Name            string `json:"name"`
	SyncStatus      string `json:"syncStatus"`
	Action          string `json:"action"`
	HealthStatus    string `json:"healthStatus,omitempty"`
	Message         string `json:"message,omitempty"`
	RequiresPruning bool   `json:"requiresPruning,omitempty"`
}

// ApplicationDiff is a compact diff view of one ArgoCD Application.
type ApplicationDiff struct {
	Tool          string              `json:"tool"`
	Name          string              `json:"name"`
	Namespace     string              `json:"namespace"`
	SyncStatus    string              `json:"syncStatus"`
	HealthStatus  string              `json:"healthStatus"`
	Revision      string              `json:"revision"`
	SourceURL     string              `json:"sourceUrl"`
	Message       string              `json:"message"`
	ResourceCount int                 `json:"resourceCount"`
	ChangedCount  int                 `json:"changedCount"`
	Resources     []ResourceDiffEntry `json:"resources"`
}

// ArgoCDDiffResponse is the top-level API response for the compact diff endpoint.
type ArgoCDDiffResponse struct {
	ClusterID    string            `json:"clusterId"`
	Timestamp    time.Time         `json:"timestamp"`
	Applications []ApplicationDiff `json:"applications"`
}
