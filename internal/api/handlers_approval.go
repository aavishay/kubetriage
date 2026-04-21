package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// ApproveRemediationHandler allows a human to approve an auto-generated fix
func ApproveRemediationHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Report ID"})
		return
	}

	// Fetch Report
	var report db.TriageReport
	if err := db.DB.First(&report, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Report not found"})
		return
	}

	if report.ApprovalStatus == "Approved" {
		c.JSON(http.StatusConflict, gin.H{"error": "Already approved"})
		return
	}

	if report.AutoRemediationPayload == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No remediation payload to approve"})
		return
	}

	// ApplyPatch Logic (VPN MODE: connect on-demand)
	cls, err := k8s.Manager.GetOrConnectCluster(report.ClusterID)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   fmt.Sprintf("Cannot connect to cluster %s: %v", report.ClusterID, err),
			"message": "Cluster may be behind a VPN. Please connect to the VPN and try again.",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	patchType := types.StrategicMergePatchType

	var patchErr error
	if report.Kind == "Deployment" {
		_, patchErr = cls.ClientSet.AppsV1().Deployments(report.Namespace).Patch(ctx, report.WorkloadName, patchType, []byte(report.AutoRemediationPayload), metav1.PatchOptions{})
	} else if report.Kind == "StatefulSet" {
		_, patchErr = cls.ClientSet.AppsV1().StatefulSets(report.Namespace).Patch(ctx, report.WorkloadName, patchType, []byte(report.AutoRemediationPayload), metav1.PatchOptions{})
	} else if report.Kind == "DaemonSet" {
		_, patchErr = cls.ClientSet.AppsV1().DaemonSets(report.Namespace).Patch(ctx, report.WorkloadName, patchType, []byte(report.AutoRemediationPayload), metav1.PatchOptions{})
	} else {
		patchErr = fmt.Errorf("unsupported workload kind for auto-patch: %s", report.Kind)
	}

	if patchErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to apply patch: %v", patchErr)})
		return
	}

	// Update DB
	db.DB.Model(&report).Updates(map[string]interface{}{
		"approval_status": "Approved",
		"is_read":         true, // Auto-mark read
	})

	c.JSON(http.StatusOK, gin.H{"status": "approved", "message": "Patch applied successfully"})
}

// RejectRemediationHandler allows a human to reject/dismiss an auto-fix
func RejectRemediationHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Report ID"})
		return
	}

	var report db.TriageReport
	if err := db.DB.First(&report, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Report not found"})
		return
	}

	db.DB.Model(&report).Updates(map[string]interface{}{
		"approval_status": "Rejected",
		"is_read":         true,
	})

	c.JSON(http.StatusOK, gin.H{"status": "rejected"})
}
