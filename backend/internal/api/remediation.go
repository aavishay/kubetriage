package api

import (
	"net/http"

	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/gin-gonic/gin"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

type GenerateRequest struct {
	ResourceKind string `json:"resourceKind"`
	ResourceName string `json:"resourceName"`
	Namespace    string `json:"namespace"`
	ErrorLog     string `json:"errorLog"`
}

type ApplyRequest struct {
	ResourceKind string `json:"resourceKind"`
	ResourceName string `json:"resourceName"`
	Namespace    string `json:"namespace"`
	PatchType    string `json:"patchType"`
	PatchContent string `json:"patchContent"`
}

func ApplyRemediationHandler(c *gin.Context) {
	var req ApplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Map Kind to GVR (Simplification: assuming apps/v1 for Deployments/StatefulSets/DaemonSets)
	// In a real app, we'd use discovery or require GVR in request
	var gvr schema.GroupVersionResource
	switch req.ResourceKind {
	case "Deployment":
		gvr = schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}
	case "StatefulSet":
		gvr = schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "statefulsets"}
	case "DaemonSet":
		gvr = schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "daemonsets"}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported resource kind"})
		return
	}

	pt := types.MergePatchType
	if req.PatchType == "application/json-patch+json" {
		pt = types.JSONPatchType
	}

	err := k8s.ApplyPatch(gvr, req.Namespace, req.ResourceName, pt, []byte(req.PatchContent))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to apply patch: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "applied", "message": "Remediation applied successfully"})
}
