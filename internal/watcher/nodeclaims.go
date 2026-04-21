package watcher

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/k8s"
)

// scanNodeClaims detects stuck or drifted node claims and creates triage reports.
func (w *Watcher) scanNodeClaims(ctx context.Context, cls *k8s.ClusterConn) {
	if cls == nil {
		return
	}

	// Scan Karpenter NodeClaims
	claims, _ := k8s.FetchKarpenterNodeClaims(ctx, cls)
	for _, claim := range claims {
		switch claim.Status {
		case "Pending":
			if claim.Age > 5*time.Minute {
				w.reportAutomationIssue(
					ctx, cls, claim.Namespace, claim.Name, "NodeClaim",
					"Karpenter NodeClaim Stuck",
					fmt.Sprintf("Karpenter NodeClaim '%s' in pool '%s' has been pending for %s. Instance type: %s, Zone: %s",
						claim.Name, claim.NodePool, claim.Age.Round(time.Second), claim.InstanceType, claim.Zone),
					"High", "",
				)
			}
		case "Drifted":
			w.reportAutomationIssue(
				ctx, cls, claim.Namespace, claim.Name, "NodeClaim",
				"Karpenter Node Drifted",
				fmt.Sprintf("Karpenter NodeClaim '%s' in pool '%s' is drifted and needs replacement. Node: %s",
					claim.Name, claim.NodePool, claim.NodeName),
				"Warning", "",
			)
		}
	}

	// Scan Azure NAP nodes
	azureClaims, _ := k8s.FetchAzureNAPNodeClaims(ctx, cls)
	for _, claim := range azureClaims {
		if claim.Status == "Pending" && claim.Age > 5*time.Minute {
			w.reportAutomationIssue(
				ctx, cls, "", claim.Name, "Node",
				"Azure NAP Provisioning Delay",
				fmt.Sprintf("Azure NAP node '%s' in pool '%s' has been pending for %s. Instance type: %s, Zone: %s",
					claim.Name, claim.NodePool, claim.Age.Round(time.Second), claim.InstanceType, claim.Zone),
				"Warning", "",
			)
		}
	}

	log.Printf("Watcher: Scanned NodeClaims for cluster %s. Karpenter: %d, Azure NAP: %d", cls.ID, len(claims), len(azureClaims))
}
