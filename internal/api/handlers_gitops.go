package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/cache"
	"github.com/aavishay/kubetriage/backend/internal/gitops"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/gin-gonic/gin"
)

// GitOpsStatusHandler returns combined ArgoCD and Flux status for a cluster
func GitOpsStatusHandler(c *gin.Context) {
	clusterID := c.Query("cluster")

	cacheKey := fmt.Sprintf("gitops:status:%s", clusterID)
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

	if client == nil || client.DynamicClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "K8s client not initialized or cluster unreachable",
			"message": "Please select a cluster and ensure VPN connection if required.",
		})
		return
	}

	ctx := c.Request.Context()

	argocd, _ := gitops.ScanArgoCD(ctx, client)
	flux, _ := gitops.ScanFlux(ctx, client)

	all := append(argocd, flux...)
	summary := gitops.BuildSummary(all)

	response := gitops.StatusResponse{
		ClusterID: clusterID,
		Timestamp: time.Now(),
		ArgoCD:    argocd,
		Flux:      flux,
		Summary:   summary,
	}

	if jsonBytes, err := json.Marshal(response); err == nil {
		cache.Set(c.Request.Context(), cacheKey, jsonBytes, 30*time.Second)
	}

	c.Header("X-Cache", "MISS")
	c.JSON(http.StatusOK, response)
}

// GitOpsApplicationsHandler returns only ArgoCD applications
func GitOpsApplicationsHandler(c *gin.Context) {
	clusterID := c.Query("cluster")

	var client *k8s.ClusterConn
	if clusterID != "" && k8s.Manager != nil {
		cls, err := k8s.Manager.GetOrConnectCluster(clusterID)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": fmt.Sprintf("Cannot connect to cluster: %v", err)})
			return
		}
		client = cls
	} else if k8s.Manager != nil && len(k8s.Manager.ListClusters()) > 0 {
		firstCluster := k8s.Manager.ListClusters()[0]
		if connected, err := k8s.Manager.GetOrConnectCluster(firstCluster.ID); err == nil {
			client = connected
		}
	}

	if client == nil || client.DynamicClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "K8s client not available"})
		return
	}

	argocd, _ := gitops.ScanArgoCD(c.Request.Context(), client)
	c.JSON(http.StatusOK, gin.H{"argocd": argocd})
}

// GitOpsFluxHandler returns only Flux resources
func GitOpsFluxHandler(c *gin.Context) {
	clusterID := c.Query("cluster")

	var client *k8s.ClusterConn
	if clusterID != "" && k8s.Manager != nil {
		cls, err := k8s.Manager.GetOrConnectCluster(clusterID)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": fmt.Sprintf("Cannot connect to cluster: %v", err)})
			return
		}
		client = cls
	} else if k8s.Manager != nil && len(k8s.Manager.ListClusters()) > 0 {
		firstCluster := k8s.Manager.ListClusters()[0]
		if connected, err := k8s.Manager.GetOrConnectCluster(firstCluster.ID); err == nil {
			client = connected
		}
	}

	if client == nil || client.DynamicClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "K8s client not available"})
		return
	}

	flux, _ := gitops.ScanFlux(c.Request.Context(), client)
	c.JSON(http.StatusOK, gin.H{"flux": flux})
}
