package watcher

import (
	"context"
	"fmt"
	"log"

	"github.com/aavishay/kubetriage/backend/internal/gitops"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
)

// scanGitOps detects GitOps issues and creates triage reports.
func (w *Watcher) scanGitOps(ctx context.Context, cls *k8s.ClusterConn) {
	if cls == nil || cls.DynamicClient == nil {
		return
	}

	// Scan ArgoCD
	argocd, _ := gitops.ScanArgoCD(ctx, cls)
	for _, app := range argocd {
		if app.HealthStatus == "Degraded" {
			w.reportAutomationIssue(
				ctx, cls, app.Namespace, app.Name, "Application",
				"ArgoCD Degraded",
				fmt.Sprintf("ArgoCD Application '%s' is degraded. Sync status: %s. Message: %s", app.Name, app.SyncStatus, app.Message),
				"High", "",
			)
		} else if app.SyncStatus == "OutOfSync" {
			w.reportAutomationIssue(
				ctx, cls, app.Namespace, app.Name, "Application",
				"ArgoCD Sync Failed",
				fmt.Sprintf("ArgoCD Application '%s' is out of sync. Revision: %s. Source: %s", app.Name, app.Revision, app.SourceURL),
				"Warning", "",
			)
		}
	}

	// Scan Flux
	flux, _ := gitops.ScanFlux(ctx, cls)
	for _, res := range flux {
		if res.HealthStatus == "Degraded" {
			incidentType := fmt.Sprintf("Flux %s Degraded", res.Kind)
			w.reportAutomationIssue(
				ctx, cls, res.Namespace, res.Name, res.Kind,
				incidentType,
				fmt.Sprintf("Flux %s '%s' is degraded. Message: %s", res.Kind, res.Name, res.Message),
				"High", "",
			)
		} else if res.SyncStatus == "OutOfSync" {
			incidentType := fmt.Sprintf("Flux %s Reconciliation Failed", res.Kind)
			w.reportAutomationIssue(
				ctx, cls, res.Namespace, res.Name, res.Kind,
				incidentType,
				fmt.Sprintf("Flux %s '%s' reconciliation failed. Revision: %s", res.Kind, res.Name, res.Revision),
				"Warning", "",
			)
		}
	}

	log.Printf("Watcher: Scanned GitOps for cluster %s. ArgoCD: %d, Flux: %d", cls.ID, len(argocd), len(flux))
}
