package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/auth"
	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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

	userInfo := c.MustGet("user").(auth.UserInfo)
	userIDStr := c.MustGet("userID").(string)

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

	// ApplyPatch Logic (simplified - using patch string directly if strategic merge compatible)
	// We need to target the correct cluster
	cls, err := k8s.Manager.GetCluster(report.ClusterID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cluster not connected"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Apply the patch
	// Assuming Strategic Merge Patch for now as standard for kubectl patch
	// NOTE: The AI generated payload might be a full YAML or a patch.
	// The GenerateRemediation tool tries to output a Patch.
	// We'll use the patch directly.

	patchType := types.StrategicMergePatchType // Default
	// Determine patching target based on Kind
	// Simple mapping for MVP (Deployments/StatefulSets/DaemonSets)

	var patchErr error
	if report.Kind == "Deployment" {
		_, patchErr = cls.ClientSet.AppsV1().Deployments(report.Namespace).Patch(ctx, report.WorkloadName, patchType, []byte(report.AutoRemediationPayload), metav1.PatchOptions{})
	} else if report.Kind == "StatefulSet" {
		_, patchErr = cls.ClientSet.AppsV1().StatefulSets(report.Namespace).Patch(ctx, report.WorkloadName, patchType, []byte(report.AutoRemediationPayload), metav1.PatchOptions{})
	} else if report.Kind == "DaemonSet" {
		_, patchErr = cls.ClientSet.AppsV1().DaemonSets(report.Namespace).Patch(ctx, report.WorkloadName, patchType, []byte(report.AutoRemediationPayload), metav1.PatchOptions{})
	} else {
		// Fallback or Error for unsupported kinds in MVP
		patchErr = fmt.Errorf("unsupported workload kind for auto-patch: %s", report.Kind)
	}

	if patchErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to apply patch: %v", patchErr)})
		return
	}

	// Update DB
	approverID, _ := uuid.Parse(userIDStr)
	db.DB.Model(&report).Updates(map[string]interface{}{
		"approval_status": "Approved",
		"approver_id":     approverID,
		"is_read":         true, // Auto-mark read
	})

	// Log Audit
	db.DB.Create(&db.AuditLog{
		UserID:    &approverID,
		UserEmail: userInfo.Email,
		Action:    "APPROVE_REMEDIATION",
		Resource:  fmt.Sprintf("%s/%s", report.Namespace, report.WorkloadName),
		Details:   fmt.Sprintf("Applied auto-fix for report %d", report.ID),
		IPAddress: c.ClientIP(),
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

	userInfo := c.MustGet("user").(auth.UserInfo)
	userIDStr := c.MustGet("userID").(string)

	var report db.TriageReport
	if err := db.DB.First(&report, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Report not found"})
		return
	}

	approverID, _ := uuid.Parse(userIDStr)
	db.DB.Model(&report).Updates(map[string]interface{}{
		"approval_status": "Rejected",
		"approver_id":     approverID,
		"is_read":         true,
	})

	// Log Audit
	db.DB.Create(&db.AuditLog{
		UserID:    &approverID,
		UserEmail: userInfo.Email,
		Action:    "REJECT_REMEDIATION",
		Resource:  fmt.Sprintf("%s/%s", report.Namespace, report.WorkloadName),
		Details:   fmt.Sprintf("Rejected auto-fix for report %d", report.ID),
		IPAddress: c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{"status": "rejected"})
}
