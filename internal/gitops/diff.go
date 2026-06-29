package gitops

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/aavishay/kubetriage/backend/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// DiffArgoCDApplications returns a compact diff for every ArgoCD Application
// installed on the cluster. It uses only the Kubernetes dynamic client; no
// ArgoCD CLI or ArgoCD API server is required.
func DiffArgoCDApplications(ctx context.Context, client *k8s.ClusterConn) ([]ApplicationDiff, error) {
	var results []ApplicationDiff
	if client == nil || client.DynamicClient == nil {
		return results, nil
	}

	gvr := schema.GroupVersionResource{
		Group:    "argoproj.io",
		Version:  "v1alpha1",
		Resource: "applications",
	}

	apps, err := client.DynamicClient.Resource(gvr).List(ctx, metav1.ListOptions{})
	if err != nil {
		// ArgoCD is probably not installed.
		return results, nil
	}

	for _, app := range apps.Items {
		results = append(results, buildApplicationDiff(app))
	}

	return results, nil
}

// buildApplicationDiff converts one ArgoCD Application unstructured object into a
// compact ApplicationDiff.
func buildApplicationDiff(app unstructured.Unstructured) ApplicationDiff {
	diff := ApplicationDiff{
		Tool:       "ArgoCD",
		Name:       app.GetName(),
		Namespace:  app.GetNamespace(),
		SyncStatus: "Unknown",
		Resources:  []ResourceDiffEntry{},
	}

	status, _ := app.Object["status"].(map[string]interface{})
	spec, _ := app.Object["spec"].(map[string]interface{})

	diff.SourceURL = extractSourceURL(spec)

	if status != nil {
		if sync, ok := status["sync"].(map[string]interface{}); ok {
			if s, ok := sync["status"].(string); ok {
				diff.SyncStatus = s
			}
			if rev, ok := sync["revision"].(string); ok {
				diff.Revision = rev
			}
		}
		if health, ok := status["health"].(map[string]interface{}); ok {
			if h, ok := health["status"].(string); ok {
				diff.HealthStatus = h
			}
		}
		if opState, ok := status["operationState"].(map[string]interface{}); ok {
			if msg, ok := opState["message"].(string); ok {
				diff.Message = msg
			} else if phase, ok := opState["phase"].(string); ok {
				diff.Message = phase
			}
		}
	}

	// Pre-index syncResult messages by resource key.
	actions := extractSyncResultActions(status)

	if status != nil {
		if resources, ok := status["resources"].([]interface{}); ok {
			diff.ResourceCount = len(resources)
			for _, r := range resources {
				resMap, ok := r.(map[string]interface{})
				if !ok {
					continue
				}
				entry := buildResourceDiffEntry(resMap, actions)
				diff.Resources = append(diff.Resources, entry)
				if entry.Action != "unchanged" || entry.SyncStatus == "OutOfSync" {
					diff.ChangedCount++
				}
			}
		}
	}

	sortResourceDiffEntries(diff.Resources)
	return diff
}

// extractSourceURL returns the first source URL found in the Application spec.
func extractSourceURL(spec map[string]interface{}) string {
	if spec == nil {
		return ""
	}
	if source, ok := spec["source"].(map[string]interface{}); ok {
		url := ""
		if repoURL, ok := source["repoURL"].(string); ok {
			url = repoURL
		}
		if path, ok := source["path"].(string); ok && path != "" {
			url = fmt.Sprintf("%s/%s", url, path)
		}
		return url
	}
	if sources, ok := spec["sources"].([]interface{}); ok && len(sources) > 0 {
		if first, ok := sources[0].(map[string]interface{}); ok {
			if repoURL, ok := first["repoURL"].(string); ok {
				return repoURL
			}
		}
	}
	return ""
}

// syncResultKey returns a stable key for matching a syncResult entry to a
// status.resources entry.
func syncResultKey(kind, namespace, name string) string {
	return strings.Join([]string{kind, namespace, name}, "/")
}

// extractSyncResultActions builds a map of resource key -> action message from
// status.operationState.syncResult.resources.
func extractSyncResultActions(status map[string]interface{}) map[string]string {
	actions := make(map[string]string)
	if status == nil {
		return actions
	}
	opState, ok := status["operationState"].(map[string]interface{})
	if !ok {
		return actions
	}
	syncResult, ok := opState["syncResult"].(map[string]interface{})
	if !ok {
		return actions
	}
	resources, ok := syncResult["resources"].([]interface{})
	if !ok {
		return actions
	}

	for _, r := range resources {
		resMap, ok := r.(map[string]interface{})
		if !ok {
			continue
		}
		kind := ""
		namespace := ""
		name := ""
		if k, ok := resMap["kind"].(string); ok {
			kind = k
		}
		if n, ok := resMap["namespace"].(string); ok {
			namespace = n
		}
		if n, ok := resMap["name"].(string); ok {
			name = n
		}
		if msg, ok := resMap["message"].(string); ok && msg != "" {
			actions[syncResultKey(kind, namespace, name)] = msg
		}
	}

	return actions
}

// buildResourceDiffEntry creates a ResourceDiffEntry from a status.resources item
// and the optional syncResult action map.
func buildResourceDiffEntry(resMap map[string]interface{}, actions map[string]string) ResourceDiffEntry {
	entry := ResourceDiffEntry{
		SyncStatus: "Unknown",
		Action:     "unknown",
	}

	if g, ok := resMap["group"].(string); ok {
		entry.Group = g
	}
	if k, ok := resMap["kind"].(string); ok {
		entry.Kind = k
	}
	if n, ok := resMap["namespace"].(string); ok {
		entry.Namespace = n
	}
	if n, ok := resMap["name"].(string); ok {
		entry.Name = n
	}
	if s, ok := resMap["status"].(string); ok {
		entry.SyncStatus = s
	}
	if m, ok := resMap["message"].(string); ok {
		entry.Message = m
	}
	if p, ok := resMap["requiresPruning"].(bool); ok {
		entry.RequiresPruning = p
	}
	if healthMap, ok := resMap["health"].(map[string]interface{}); ok {
		if hs, ok := healthMap["status"].(string); ok {
			entry.HealthStatus = hs
		}
	}

	key := syncResultKey(entry.Kind, entry.Namespace, entry.Name)
	if action, ok := actions[key]; ok {
		entry.Action = normalizeAction(action)
	} else {
		entry.Action = deriveAction(entry.SyncStatus, entry.RequiresPruning)
	}

	return entry
}

// normalizeAction converts an ArgoCD syncResult message into a compact action.
func normalizeAction(msg string) string {
	msg = strings.ToLower(strings.TrimSpace(msg))
	if msg == "" {
		return "unknown"
	}
	switch {
	case strings.Contains(msg, "unchanged"):
		return "unchanged"
	case strings.Contains(msg, "configured"):
		return "configured"
	case strings.Contains(msg, "created"):
		return "created"
	case strings.Contains(msg, "pruned"):
		return "pruned"
	case strings.Contains(msg, "synced"):
		return "unchanged"
	default:
		return msg
	}
}

// deriveAction chooses an action when syncResult is not available.
func deriveAction(syncStatus string, requiresPruning bool) string {
	if requiresPruning {
		return "pruned"
	}
	switch syncStatus {
	case "Synced":
		return "unchanged"
	case "OutOfSync":
		return "configured"
	default:
		return "unknown"
	}
}

// sortResourceDiffEntries sorts changed entries first, then by kind/name.
func sortResourceDiffEntries(entries []ResourceDiffEntry) {
	sort.SliceStable(entries, func(i, j int) bool {
		iChanged := entries[i].Action != "unchanged" || entries[i].SyncStatus == "OutOfSync" || entries[i].RequiresPruning
		jChanged := entries[j].Action != "unchanged" || entries[j].SyncStatus == "OutOfSync" || entries[j].RequiresPruning
		if iChanged != jChanged {
			return iChanged // changed first
		}
		if entries[i].Kind != entries[j].Kind {
			return entries[i].Kind < entries[j].Kind
		}
		if entries[i].Namespace != entries[j].Namespace {
			return entries[i].Namespace < entries[j].Namespace
		}
		return entries[i].Name < entries[j].Name
	})
}
