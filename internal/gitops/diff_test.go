package gitops

import (
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestBuildApplicationDiff_WithSyncResult(t *testing.T) {
	app := unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "argoproj.io/v1alpha1",
			"kind":       "Application",
			"metadata": map[string]interface{}{
				"name":      "aks-nodepool-exporter",
				"namespace": "argocd",
			},
			"spec": map[string]interface{}{
				"source": map[string]interface{}{
					"repoURL": "git@ssh.dev.azure.com:v3/Chicago/argocd/charts/aks-nodepool-exporter",
					"path":    "aks-nodepool-exporter",
				},
			},
			"status": map[string]interface{}{
				"sync": map[string]interface{}{
					"status":   "Synced",
					"revision": "4287fdcb1234567890abcdef1234567890abcdef",
				},
				"health": map[string]interface{}{
					"status": "Healthy",
				},
				"operationState": map[string]interface{}{
					"message": "successfully synced (all tasks run)",
					"phase":   "Succeeded",
					"syncResult": map[string]interface{}{
						"resources": []interface{}{
							map[string]interface{}{
								"kind":      "ServiceAccount",
								"namespace": "default",
								"name":      "aks-nodepool-exporter",
								"message":   "serviceaccount/aks-nodepool-exporter unchanged",
							},
							map[string]interface{}{
								"kind":    "ClusterRole",
								"name":    "aks-nodepool-exporter",
								"message": "clusterrole.rbac.authorization.k8s.io/aks-nodepool-exporter reconciled. clusterrole.rbac.authorization.k8s.io/aks-nodepool-exporter unchanged",
							},
							map[string]interface{}{
								"kind":      "Deployment",
								"namespace": "default",
								"name":      "aks-nodepool-exporter",
								"message":   "deployment.apps/aks-nodepool-exporter configured",
							},
						},
					},
				},
				"resources": []interface{}{
					map[string]interface{}{
						"group":     "",
						"kind":      "ServiceAccount",
						"namespace": "default",
						"name":      "aks-nodepool-exporter",
						"status":    "Synced",
						"health": map[string]interface{}{
							"status": "Healthy",
						},
					},
					map[string]interface{}{
						"group":  "rbac.authorization.k8s.io",
						"kind":   "ClusterRole",
						"name":   "aks-nodepool-exporter",
						"status": "Synced",
					},
					map[string]interface{}{
						"group":     "apps",
						"kind":      "Deployment",
						"namespace": "default",
						"name":      "aks-nodepool-exporter",
						"status":    "Synced",
						"health": map[string]interface{}{
							"status": "Healthy",
						},
					},
				},
			},
		},
	}

	diff := buildApplicationDiff(app)

	if diff.Name != "aks-nodepool-exporter" {
		t.Errorf("expected name aks-nodepool-exporter, got %s", diff.Name)
	}
	if diff.Namespace != "argocd" {
		t.Errorf("expected namespace argocd, got %s", diff.Namespace)
	}
	if diff.SyncStatus != "Synced" {
		t.Errorf("expected sync status Synced, got %s", diff.SyncStatus)
	}
	if diff.HealthStatus != "Healthy" {
		t.Errorf("expected health Healthy, got %s", diff.HealthStatus)
	}
	if diff.ResourceCount != 3 {
		t.Errorf("expected 3 resources, got %d", diff.ResourceCount)
	}
	if diff.ChangedCount != 1 {
		t.Errorf("expected 1 changed resource, got %d", diff.ChangedCount)
	}
	if diff.Message != "successfully synced (all tasks run)" {
		t.Errorf("expected operation message, got %s", diff.Message)
	}

	changed := diff.Resources[0]
	if changed.Kind != "Deployment" || changed.Name != "aks-nodepool-exporter" {
		t.Errorf("expected first changed resource to be Deployment/aks-nodepool-exporter, got %s/%s", changed.Kind, changed.Name)
	}
	if changed.Action != "configured" {
		t.Errorf("expected action configured, got %s", changed.Action)
	}

	for _, r := range diff.Resources[1:] {
		if r.Action != "unchanged" {
			t.Errorf("expected resource %s/%s to be unchanged, got %s", r.Kind, r.Name, r.Action)
		}
	}
}

func TestBuildApplicationDiff_FallbackWithoutSyncResult(t *testing.T) {
	app := unstructured.Unstructured{
		Object: map[string]interface{}{
			"metadata": map[string]interface{}{
				"name":      "fallback-app",
				"namespace": "argocd",
			},
			"spec": map[string]interface{}{
				"sources": []interface{}{
					map[string]interface{}{
						"repoURL": "https://github.com/org/repo",
						"path":    "apps",
					},
				},
			},
			"status": map[string]interface{}{
				"sync": map[string]interface{}{
					"status": "OutOfSync",
				},
				"resources": []interface{}{
					map[string]interface{}{
						"kind":      "ConfigMap",
						"namespace": "default",
						"name":      "cm-one",
						"status":    "Synced",
					},
					map[string]interface{}{
						"kind":      "Deployment",
						"namespace": "default",
						"name":      "dep-one",
						"status":    "OutOfSync",
					},
				},
			},
		},
	}

	diff := buildApplicationDiff(app)
	if diff.SyncStatus != "OutOfSync" {
		t.Errorf("expected OutOfSync, got %s", diff.SyncStatus)
	}
	if diff.ChangedCount != 1 {
		t.Errorf("expected 1 changed, got %d", diff.ChangedCount)
	}

	for _, r := range diff.Resources {
		if r.Kind == "Deployment" {
			if r.Action != "configured" {
				t.Errorf("expected Deployment action configured, got %s", r.Action)
			}
		} else if r.Kind == "ConfigMap" {
			if r.Action != "unchanged" {
				t.Errorf("expected ConfigMap action unchanged, got %s", r.Action)
			}
		}
	}
}

func TestBuildApplicationDiff_Pruning(t *testing.T) {
	app := unstructured.Unstructured{
		Object: map[string]interface{}{
			"metadata": map[string]interface{}{
				"name":      "prune-app",
				"namespace": "argocd",
			},
			"status": map[string]interface{}{
				"sync": map[string]interface{}{
					"status": "Synced",
				},
				"resources": []interface{}{
					map[string]interface{}{
						"kind":            "Service",
						"namespace":       "default",
						"name":            "old-svc",
						"status":          "Synced",
						"requiresPruning": true,
					},
				},
			},
		},
	}

	diff := buildApplicationDiff(app)
	if diff.ChangedCount != 1 {
		t.Errorf("expected 1 changed (pruned), got %d", diff.ChangedCount)
	}
	if diff.Resources[0].Action != "pruned" {
		t.Errorf("expected action pruned, got %s", diff.Resources[0].Action)
	}
}

func TestExtractSourceURL(t *testing.T) {
	single := map[string]interface{}{
		"source": map[string]interface{}{
			"repoURL": "https://github.com/org/repo",
			"path":    "charts/app",
		},
	}
	if got := extractSourceURL(single); got != "https://github.com/org/repo/charts/app" {
		t.Errorf("expected single source URL, got %s", got)
	}

	multi := map[string]interface{}{
		"sources": []interface{}{
			map[string]interface{}{
				"repoURL": "https://github.com/org/multi",
			},
		},
	}
	if got := extractSourceURL(multi); got != "https://github.com/org/multi" {
		t.Errorf("expected multi source URL, got %s", got)
	}

	if got := extractSourceURL(nil); got != "" {
		t.Errorf("expected empty source URL for nil spec, got %s", got)
	}
}

func TestNormalizeAction(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"serviceaccount/foo unchanged", "unchanged"},
		{"deployment.apps/foo configured", "configured"},
		{"configmap/foo created", "created"},
		{"service/foo pruned", "pruned"},
		{"", "unknown"},
	}
	for _, tc := range cases {
		if got := normalizeAction(tc.input); got != tc.expected {
			t.Errorf("normalizeAction(%q) = %q, want %q", tc.input, got, tc.expected)
		}
	}
}
