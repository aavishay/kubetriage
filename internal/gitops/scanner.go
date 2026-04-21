package gitops

import (
	"context"
	"fmt"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/k8s"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// ScanArgoCD lists ArgoCD Applications and returns their status.
func ScanArgoCD(ctx context.Context, client *k8s.ClusterConn) ([]GitOpsResource, error) {
	var results []GitOpsResource
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
		return results, nil // Graceful: ArgoCD not installed
	}

	for _, app := range apps.Items {
		res := GitOpsResource{
			Tool:       "ArgoCD",
			Kind:       "Application",
			Name:       app.GetName(),
			Namespace:  app.GetNamespace(),
			SyncStatus: "Unknown",
			HealthStatus: "Unknown",
		}

		// Extract spec source
		if spec, ok := app.Object["spec"].(map[string]interface{}); ok {
			if source, ok := spec["source"].(map[string]interface{}); ok {
				if repoURL, ok := source["repoURL"].(string); ok {
					res.SourceURL = repoURL
				}
				if path, ok := source["path"].(string); ok && path != "" {
					res.SourceURL = fmt.Sprintf("%s/%s", res.SourceURL, path)
				}
			}
			if sources, ok := spec["sources"].([]interface{}); ok && len(sources) > 0 {
				if firstSource, ok := sources[0].(map[string]interface{}); ok {
					if repoURL, ok := firstSource["repoURL"].(string); ok {
						res.SourceURL = repoURL
					}
				}
			}
		}

		// Extract status
		if status, ok := app.Object["status"].(map[string]interface{}); ok {
			if sync, ok := status["sync"].(map[string]interface{}); ok {
				if s, ok := sync["status"].(string); ok {
					res.SyncStatus = s
				}
				if rev, ok := sync["revision"].(string); ok {
					res.Revision = rev
				}
			}
			if health, ok := status["health"].(map[string]interface{}); ok {
				if h, ok := health["status"].(string); ok {
					res.HealthStatus = h
				}
			}
			if opState, ok := status["operationState"].(map[string]interface{}); ok {
				if msg, ok := opState["message"].(string); ok {
					res.Message = msg
				}
				if phase, ok := opState["phase"].(string); ok && res.Message == "" {
					res.Message = phase
				}
			}
			if resources, ok := status["resources"].([]interface{}); ok {
				res.ResourceCount = len(resources)
				for _, r := range resources {
					if resMap, ok := r.(map[string]interface{}); ok {
						if healthStatus, ok := resMap["health"].(map[string]interface{}); ok {
							if hs, ok := healthStatus["status"].(string); ok && hs == "Healthy" {
								res.ReadyResources++
							}
						}
					}
				}
			}
			if conds, ok := status["conditions"].([]interface{}); ok {
				for _, c := range conds {
					if cMap, ok := c.(map[string]interface{}); ok {
						condition := GitOpsCondition{}
						if t, ok := cMap["type"].(string); ok {
							condition.Type = t
						}
						if s, ok := cMap["status"].(string); ok {
							condition.Status = s
						}
						if r, ok := cMap["reason"].(string); ok {
							condition.Reason = r
						}
						if m, ok := cMap["message"].(string); ok {
							condition.Message = m
						}
						if lt, ok := cMap["lastTransitionTime"].(string); ok {
							condition.LastTransitionTime, _ = time.Parse(time.RFC3339, lt)
						}
						res.Conditions = append(res.Conditions, condition)
					}
				}
			}
			if syncErrs, ok := status["sync"].(map[string]interface{}); ok {
				if comparedTo, ok := syncErrs["comparedTo"].(map[string]interface{}); ok {
					_ = comparedTo
				}
			}
			// Collect sync errors from operationState.syncResult.resources
			if opState, ok := status["operationState"].(map[string]interface{}); ok {
				if syncResult, ok := opState["syncResult"].(map[string]interface{}); ok {
					if resources, ok := syncResult["resources"].([]interface{}); ok {
						for _, r := range resources {
							if resMap, ok := r.(map[string]interface{}); ok {
								if msg, ok := resMap["message"].(string); ok && msg != "" {
									res.SyncErrors = append(res.SyncErrors, fmt.Sprintf("%s/%s: %s", resMap["kind"], resMap["name"], msg))
								}
							}
						}
					}
				}
			}
		}

		// Basic misconfiguration checks
		if res.SyncStatus == "OutOfSync" {
			res.Misconfigurations = append(res.Misconfigurations, "Application is out of sync with Git")
		}
		if res.HealthStatus == "Degraded" {
			res.Misconfigurations = append(res.Misconfigurations, "Application health is degraded")
		}
		if res.ReadyResources > 0 && res.ResourceCount > 0 && res.ReadyResources < res.ResourceCount {
			res.Misconfigurations = append(res.Misconfigurations,
				fmt.Sprintf("Only %d/%d resources are healthy", res.ReadyResources, res.ResourceCount))
		}

		results = append(results, res)
	}

	return results, nil
}

// ScanFlux lists Flux Kustomizations, HelmReleases, and GitRepositories.
func ScanFlux(ctx context.Context, client *k8s.ClusterConn) ([]GitOpsResource, error) {
	var results []GitOpsResource
	if client == nil || client.DynamicClient == nil {
		return results, nil
	}

	// Scan Kustomizations
	results = append(results, scanFluxKustomizations(ctx, client)...)
	// Scan HelmReleases
	results = append(results, scanFluxHelmReleases(ctx, client)...)
	// Scan GitRepositories
	results = append(results, scanFluxGitRepositories(ctx, client)...)

	return results, nil
}

func scanFluxKustomizations(ctx context.Context, client *k8s.ClusterConn) []GitOpsResource {
	var results []GitOpsResource
	gvr := schema.GroupVersionResource{
		Group:    "kustomize.toolkit.fluxcd.io",
		Version:  "v1",
		Resource: "kustomizations",
	}

	items, err := client.DynamicClient.Resource(gvr).List(ctx, metav1.ListOptions{})
	if err != nil {
		return results
	}

	for _, item := range items.Items {
		res := fluxResourceFromUnstructured(item.Object, "Kustomization")
		results = append(results, res)
	}
	return results
}

func scanFluxHelmReleases(ctx context.Context, client *k8s.ClusterConn) []GitOpsResource {
	var results []GitOpsResource
	// Try v2 first, fallback to v2beta1
	for _, version := range []string{"v2", "v2beta1"} {
		gvr := schema.GroupVersionResource{
			Group:    "helm.toolkit.fluxcd.io",
			Version:  version,
			Resource: "helmreleases",
		}
		items, err := client.DynamicClient.Resource(gvr).List(ctx, metav1.ListOptions{})
		if err != nil {
			continue
		}
		for _, item := range items.Items {
			res := fluxResourceFromUnstructured(item.Object, "HelmRelease")
			// Extract chart source URL
			if spec, ok := item.Object["spec"].(map[string]interface{}); ok {
				if chart, ok := spec["chart"].(map[string]interface{}); ok {
					if spec2, ok := chart["spec"].(map[string]interface{}); ok {
						if source, ok := spec2["sourceRef"].(map[string]interface{}); ok {
							if ns, ok := source["namespace"].(string); ok {
								if name, ok := source["name"].(string); ok {
									res.SourceURL = fmt.Sprintf("source: %s/%s", ns, name)
								}
							}
						}
					}
				}
			}
			results = append(results, res)
		}
		break
	}
	return results
}

func scanFluxGitRepositories(ctx context.Context, client *k8s.ClusterConn) []GitOpsResource {
	var results []GitOpsResource
	// Try v1 first, fallback to v1beta2
	for _, version := range []string{"v1", "v1beta2"} {
		gvr := schema.GroupVersionResource{
			Group:    "source.toolkit.fluxcd.io",
			Version:  version,
			Resource: "gitrepositories",
		}
		items, err := client.DynamicClient.Resource(gvr).List(ctx, metav1.ListOptions{})
		if err != nil {
			continue
		}
		for _, item := range items.Items {
			res := fluxResourceFromUnstructured(item.Object, "GitRepository")
			if spec, ok := item.Object["spec"].(map[string]interface{}); ok {
				if url, ok := spec["url"].(string); ok {
					res.SourceURL = url
				}
			}
			if status, ok := item.Object["status"].(map[string]interface{}); ok {
				if artifact, ok := status["artifact"].(map[string]interface{}); ok {
					if rev, ok := artifact["revision"].(string); ok {
						res.Revision = rev
					}
				}
			}
			results = append(results, res)
		}
		break
	}
	return results
}

func fluxResourceFromUnstructured(item map[string]interface{}, kind string) GitOpsResource {
	metadata := item["metadata"].(map[string]interface{})
	res := GitOpsResource{
		Tool:         "Flux",
		Kind:         kind,
		Name:         metadata["name"].(string),
		Namespace:    "",
		SyncStatus:   "Unknown",
		HealthStatus: "Unknown",
	}
	if ns, ok := metadata["namespace"].(string); ok {
		res.Namespace = ns
	}

	if status, ok := item["status"].(map[string]interface{}); ok {
		if conds, ok := status["conditions"].([]interface{}); ok {
			ready := false
			reconciling := false
			stalled := false
			var lastAppliedRev string
			for _, c := range conds {
				if cMap, ok := c.(map[string]interface{}); ok {
					condition := GitOpsCondition{}
					if t, ok := cMap["type"].(string); ok {
						condition.Type = t
					}
					if s, ok := cMap["status"].(string); ok {
						condition.Status = s
					}
					if r, ok := cMap["reason"].(string); ok {
						condition.Reason = r
					}
					if m, ok := cMap["message"].(string); ok {
						condition.Message = m
					}
					if lt, ok := cMap["lastTransitionTime"].(string); ok {
						condition.LastTransitionTime, _ = time.Parse(time.RFC3339, lt)
					}
					res.Conditions = append(res.Conditions, condition)

					if condition.Type == "Ready" {
						if condition.Status == "True" {
							ready = true
						}
						if condition.Message != "" {
							res.Message = condition.Message
						}
					}
					if condition.Type == "Reconciling" && condition.Status == "True" {
						reconciling = true
					}
					if condition.Type == "Stalled" && condition.Status == "True" {
						stalled = true
					}
				}
			}

			if stalled {
				res.HealthStatus = "Degraded"
				res.SyncStatus = "OutOfSync"
				res.Misconfigurations = append(res.Misconfigurations, "Resource is stalled")
			} else if reconciling {
				res.HealthStatus = "Progressing"
				res.SyncStatus = "OutOfSync"
			} else if ready {
				res.HealthStatus = "Healthy"
				res.SyncStatus = "Synced"
			} else {
				res.HealthStatus = "Degraded"
				res.SyncStatus = "OutOfSync"
			}
			if lastAppliedRev != "" {
				res.Revision = lastAppliedRev
			}
		}

		if lastApplied, ok := status["lastAppliedRevision"].(string); ok {
			res.Revision = lastApplied
		}
		if lastAttempted, ok := status["lastAttemptedRevision"].(string); ok && res.Revision == "" {
			res.Revision = lastAttempted
		}
	}

	return res
}

// BuildSummary computes aggregate counts from a list of resources.
func BuildSummary(resources []GitOpsResource) Summary {
	s := Summary{Total: len(resources)}
	for _, r := range resources {
		switch r.SyncStatus {
		case "Synced":
			s.Synced++
		case "OutOfSync":
			s.OutOfSync++
		default:
			s.Unknown++
		}
		switch r.HealthStatus {
		case "Degraded":
			s.Degraded++
		case "Progressing":
			s.Progressing++
		case "Suspended":
			s.Suspended++
		case "Healthy":
			// counted in synced
		default:
			s.Unknown++
		}
	}
	return s
}
