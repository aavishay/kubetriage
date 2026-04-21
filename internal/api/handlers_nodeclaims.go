package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/cache"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/gin-gonic/gin"
)

// NodeClaimsSummary aggregates node claim status
type NodeClaimsSummary struct {
	Total                  int     `json:"total"`
	Ready                  int     `json:"ready"`
	Pending                int     `json:"pending"`
	Drifted                int     `json:"drifted"`
	Expired                int     `json:"expired"`
	Terminating            int     `json:"terminating"`
	Unknown                int     `json:"unknown"`
	AvgProvisioningTimeSec float64 `json:"avgProvisioningTimeSec"`
	StuckPendingCount      int     `json:"stuckPendingCount"`
}

// NodeClaimsResponse is the top-level API response
type NodeClaimsResponse struct {
	ClusterID string              `json:"clusterId"`
	Timestamp time.Time           `json:"timestamp"`
	Claims    []k8s.NodeClaim     `json:"claims"`
	Summary   NodeClaimsSummary   `json:"summary"`
}

// NodeClaimsHandler returns detailed node claim progress for a cluster
func NodeClaimsHandler(c *gin.Context) {
	clusterID := c.Query("cluster")

	cacheKey := fmt.Sprintf("nodeclaims:%s", clusterID)
	if val, err := cache.Get(c.Request.Context(), cacheKey); err == nil {
		c.Header("X-Cache", "HIT")
		c.Data(http.StatusOK, "application/json", []byte(val))
		return
	}

	var client *k8s.ClusterConn
	if clusterID != "" && k8s.Manager != nil {
		cls, err := k8s.Manager.GetOrConnectCluster(clusterID)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":   fmt.Sprintf("Cannot connect to cluster: %v", err),
				"message": "Cluster may be behind a VPN. Please connect to the VPN and try again.",
			})
			return
		}
		client = cls
	} else if k8s.Manager != nil && len(k8s.Manager.ListClusters()) > 0 {
		firstCluster := k8s.Manager.ListClusters()[0]
		if connected, err := k8s.Manager.GetOrConnectCluster(firstCluster.ID); err == nil {
			client = connected
		}
	}

	if client == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "K8s client not initialized or cluster unreachable",
			"message": "Please select a cluster and ensure VPN connection if required.",
		})
		return
	}

	ctx := c.Request.Context()

	var allClaims []k8s.NodeClaim

	// Try Karpenter
	karpenterClaims, _ := k8s.FetchKarpenterNodeClaims(ctx, client)
	allClaims = append(allClaims, karpenterClaims...)

	// Try Azure NAP
	azureClaims, _ := k8s.FetchAzureNAPNodeClaims(ctx, client)
	allClaims = append(allClaims, azureClaims...)

	summary := buildNodeClaimsSummary(allClaims)

	response := NodeClaimsResponse{
		ClusterID: clusterID,
		Timestamp: time.Now(),
		Claims:    allClaims,
		Summary:   summary,
	}

	if jsonBytes, err := json.Marshal(response); err == nil {
		cache.Set(c.Request.Context(), cacheKey, jsonBytes, 30*time.Second)
	}

	c.Header("X-Cache", "MISS")
	c.JSON(http.StatusOK, response)
}

func buildNodeClaimsSummary(claims []k8s.NodeClaim) NodeClaimsSummary {
	s := NodeClaimsSummary{Total: len(claims)}
	var totalProvisioningTime time.Duration
	var provisioningCount int

	for _, c := range claims {
		switch c.Status {
		case "Ready":
			s.Ready++
			if c.LaunchTime != nil && c.RegistrationTime != nil {
				totalProvisioningTime += c.RegistrationTime.Sub(*c.LaunchTime)
				provisioningCount++
			}
		case "Pending":
			s.Pending++
			if c.Age > 5*time.Minute {
				s.StuckPendingCount++
			}
		case "Drifted":
			s.Drifted++
		case "Expired":
			s.Expired++
		case "Terminating":
			s.Terminating++
		default:
			s.Unknown++
		}
	}

	if provisioningCount > 0 {
		s.AvgProvisioningTimeSec = totalProvisioningTime.Seconds() / float64(provisioningCount)
	}

	return s
}
