package api

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// AutoFixProposal represents an AI-generated fix proposal that requires approval
type AutoFixProposal struct {
	ID              string            `json:"id"`
	ReportID        uint              `json:"reportId"`
	WorkloadID      string            `json:"workloadId"`
	ClusterID       string            `json:"clusterId"` // Target cluster for the fix
	Namespace       string            `json:"namespace"`
	Name            string            `json:"name"`
	Kind            string            `json:"kind"`
	Issue           string            `json:"issue"`
	ProposedFix     FixAction         `json:"proposedFix"`
	RiskLevel       string            `json:"riskLevel"` // low, medium, high
	EstimatedImpact string            `json:"estimatedImpact"`
	RollbackPlan    RollbackStrategy  `json:"rollbackPlan"`
	Status          string            `json:"status"` // pending, approved, rejected, applied, rolled_back, failed
	CreatedAt       time.Time         `json:"createdAt"`
	ApprovedBy      string            `json:"approvedBy,omitempty"`
	ApprovedAt      *time.Time        `json:"approvedAt,omitempty"`
	AppliedAt       *time.Time        `json:"appliedAt,omitempty"`
	RollbackAt      *time.Time        `json:"rollbackAt,omitempty"`
	Result          *FixResult        `json:"result,omitempty"`
}

// FixAction represents the specific fix to apply
type FixAction struct {
	Type        string `json:"type"`        // patch, restart, scale, delete_pod
	Description string `json:"description"` // human readable description
	Patch       string `json:"patch,omitempty"`       // JSON merge patch
	Reasoning   string `json:"reasoning"`   // AI explanation
}

// RollbackStrategy describes how to rollback if the fix fails
type RollbackStrategy struct {
	Strategy    string `json:"strategy"`    // revert_patch, recreate, restore_backup
	BackupPatch string `json:"backupPatch,omitempty"` // The original state to restore
	Timeout     int    `json:"timeout"`     // seconds to wait before considering rollback
}

// FixResult contains the outcome of applying a fix
type FixResult struct {
	Success   bool      `json:"success"`
	Message   string    `json:"message"`
	Error     string    `json:"error,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// In-memory store for proposals (in production, use database)
// These stores have a max size limit to prevent unbounded growth
const (
	maxAutoFixProposals = 1000
	maxScheduledFixes   = 1000
	maxRunbooks         = 500
)

var (
	autoFixProposals = make(map[string]*AutoFixProposal)
	scheduledFixes   = make(map[string]*ScheduledFix)
	runbooks         = make(map[string]*ExecutableRunbook)
)

// cleanupStore removes oldest items from a map if it exceeds maxItems.
// getTimestamp extracts the creation timestamp from a map value.
func cleanupStore[K comparable, V any](store map[K]*V, maxItems int, getTimestamp func(*V) time.Time) {
	if len(store) <= maxItems {
		return
	}
	type item struct {
		key K
		ts  time.Time
	}
	items := make([]item, 0, len(store))
	for key, v := range store {
		items = append(items, item{key: key, ts: getTimestamp(v)})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ts.Before(items[j].ts) })
	toRemove := len(items) - maxItems
	for i := 0; i < toRemove; i++ {
		delete(store, items[i].key)
	}
}

func cleanupOldProposals() {
	cleanupStore(autoFixProposals, maxAutoFixProposals, func(p *AutoFixProposal) time.Time { return p.CreatedAt })
}

func cleanupOldScheduledFixes() {
	cleanupStore(scheduledFixes, maxScheduledFixes, func(s *ScheduledFix) time.Time { return s.CreatedAt })
}

func cleanupOldRunbooks() {
	cleanupStore(runbooks, maxRunbooks, func(r *ExecutableRunbook) time.Time { return r.CreatedAt })
}

// ListAutoFixProposalsHandler returns all auto-fix proposals
type ListAutoFixProposalsHandler struct{}

func (h *ListAutoFixProposalsHandler) ServeHTTP(c *gin.Context) {
	var proposals []AutoFixProposal
	for _, p := range autoFixProposals {
		proposals = append(proposals, *p)
	}

	c.JSON(http.StatusOK, gin.H{
		"proposals": proposals,
		"count":     len(proposals),
	})
}

// GetAutoFixProposalHandler returns a specific proposal
type GetAutoFixProposalHandler struct{}

func (h *GetAutoFixProposalHandler) ServeHTTP(c *gin.Context) {
	id := c.Param("id")
	proposal, exists := autoFixProposals[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Proposal not found"})
		return
	}

	c.JSON(http.StatusOK, proposal)
}

// CreateAutoFixProposalHandler creates a new auto-fix proposal from AI analysis
type CreateAutoFixProposalHandler struct{}

func (h *CreateAutoFixProposalHandler) ServeHTTP(c *gin.Context) {
	var request struct {
		ReportID   uint   `json:"reportId"`
		WorkloadID string `json:"workloadId"`
		Namespace  string `json:"namespace"`
		Name       string `json:"name"`
		Kind       string `json:"kind"`
		Issue      string `json:"issue"`
		FixType    string `json:"fixType"` // e.g., "restart", "scale", "patch"
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate AI-driven fix proposal
	proposal := generateFixProposal(request)
	autoFixProposals[proposal.ID] = &proposal
	cleanupOldProposals()

	c.JSON(http.StatusCreated, proposal)
}

func generateFixProposal(req struct {
	ReportID   uint   `json:"reportId"`
	WorkloadID string `json:"workloadId"`
	Namespace  string `json:"namespace"`
	Name       string `json:"name"`
	Kind       string `json:"kind"`
	Issue      string `json:"issue"`
	FixType    string `json:"fixType"`
}) AutoFixProposal {
	proposal := AutoFixProposal{
		ID:         uuid.New().String(),
		ReportID:   req.ReportID,
		WorkloadID: req.WorkloadID,
		Namespace:  req.Namespace,
		Name:       req.Name,
		Kind:       req.Kind,
		Issue:      req.Issue,
		Status:     "pending",
		CreatedAt:  time.Now(),
	}

	// Determine fix based on issue type
	switch req.FixType {
	case "restart":
		proposal.RiskLevel = "low"
		proposal.ProposedFix = FixAction{
			Type:        "restart",
			Description: fmt.Sprintf("Restart deployment %s/%s to clear transient state", req.Namespace, req.Name),
			Reasoning:   "Restarting will recreate pods with fresh state, often resolving CrashLoopBackOff caused by temporary issues",
		}
		proposal.RollbackPlan = RollbackStrategy{
			Strategy: "revert_patch",
			Timeout:  300,
		}
		proposal.EstimatedImpact = "Brief service interruption (30-60s) during pod recreation"

	case "scale":
		proposal.RiskLevel = "medium"
		proposal.ProposedFix = FixAction{
			Type:        "scale",
			Description: fmt.Sprintf("Scale %s/%s to appropriate replica count", req.Namespace, req.Name),
			Reasoning:   "Adjusting replica count to match resource demands and ensure high availability",
		}
		proposal.RollbackPlan = RollbackStrategy{
			Strategy: "revert_patch",
			Timeout:  180,
		}
		proposal.EstimatedImpact = "Traffic redistribution during scaling operation"

	case "patch":
		proposal.RiskLevel = "medium"
		proposal.ProposedFix = FixAction{
			Type:        "patch",
			Description: fmt.Sprintf("Apply configuration patch to %s/%s", req.Namespace, req.Name),
			Reasoning:   "Patch addresses the root cause of the issue by fixing misconfiguration",
		}
		proposal.RollbackPlan = RollbackStrategy{
			Strategy:    "revert_patch",
			BackupPatch: "{}", // Would be actual original state
			Timeout:     300,
		}
		proposal.EstimatedImpact = "Configuration change applied immediately"

	default:
		proposal.RiskLevel = "high"
		proposal.ProposedFix = FixAction{
			Type:        "manual_review",
			Description: "Requires manual intervention",
			Reasoning:   "Issue complexity requires human expert review",
		}
		proposal.EstimatedImpact = "Unknown - manual review required"
	}

	return proposal
}

// ApproveAutoFixHandler allows human approval of a fix
type ApproveAutoFixHandler struct{}

func (h *ApproveAutoFixHandler) ServeHTTP(c *gin.Context) {
	id := c.Param("id")
	var request struct {
		Approved bool   `json:"approved"`
		User     string `json:"user"`
		Comment  string `json:"comment,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	proposal, exists := autoFixProposals[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Proposal not found"})
		return
	}

	if proposal.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Proposal is already %s", proposal.Status)})
		return
	}

	now := time.Now()
	if request.Approved {
		proposal.Status = "approved"
		proposal.ApprovedBy = request.User
		proposal.ApprovedAt = &now

		// Auto-apply low-risk fixes immediately after approval
		if proposal.RiskLevel == "low" {
			go applyFixWithRollback(proposal)
		}

		c.JSON(http.StatusOK, gin.H{
			"message":  "Fix approved",
			"proposal": proposal,
		})
	} else {
		proposal.Status = "rejected"
		c.JSON(http.StatusOK, gin.H{
			"message":  "Fix rejected",
			"proposal": proposal,
		})
	}
}

// ApplyAutoFixHandler applies an approved fix
type ApplyAutoFixHandler struct{}

func (h *ApplyAutoFixHandler) ServeHTTP(c *gin.Context) {
	id := c.Param("id")
	var request struct {
		User string `json:"user"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	proposal, exists := autoFixProposals[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Proposal not found"})
		return
	}

	if proposal.Status != "approved" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fix must be approved before applying"})
		return
	}

	// Apply the fix with rollback safety
	result := applyFixWithRollback(proposal)

	c.JSON(http.StatusOK, gin.H{
		"message":  "Fix applied",
		"result":   result,
		"proposal": proposal,
	})
}

// RollbackAutoFixHandler rolls back a failed fix
type RollbackAutoFixHandler struct{}

func (h *RollbackAutoFixHandler) ServeHTTP(c *gin.Context) {
	id := c.Param("id")
	proposal, exists := autoFixProposals[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Proposal not found"})
		return
	}

	if proposal.Status != "applied" && proposal.Status != "failed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only rollback applied or failed fixes"})
		return
	}

	result := performRollback(proposal)
	now := time.Now()
	proposal.RollbackAt = &now

	c.JSON(http.StatusOK, gin.H{
		"message":  "Fix rolled back",
		"result":   result,
		"proposal": proposal,
	})
}

// applyFixWithRollback applies a fix and monitors for failure
func applyFixWithRollback(proposal *AutoFixProposal) *FixResult {
	ctx := context.Background()
	now := time.Now()
	proposal.AppliedAt = &now
	proposal.Status = "applying"

	result := &FixResult{
		Timestamp: time.Now(),
	}

	// Apply the fix based on type
	switch proposal.ProposedFix.Type {
	case "restart":
		if err := restartDeployment(ctx, proposal.Namespace, proposal.Name, proposal.ClusterID); err != nil {
			result.Success = false
			result.Error = err.Error()
			proposal.Status = "failed"
			// Trigger automatic rollback
			go performRollback(proposal)
		} else {
			result.Success = true
			result.Message = "Deployment restarted successfully"
			proposal.Status = "applied"
		}

	case "scale":
		if err := scaleDeployment(ctx, proposal.Namespace, proposal.Name, proposal.ClusterID, 1); err != nil {
			result.Success = false
			result.Error = err.Error()
			proposal.Status = "failed"
			go performRollback(proposal)
		} else {
			result.Success = true
			result.Message = "Deployment scaled successfully"
			proposal.Status = "applied"
		}

	case "patch":
		if err := applyPatch(ctx, proposal.Namespace, proposal.Name, proposal.Kind, proposal.ProposedFix.Patch, proposal.ClusterID); err != nil {
			result.Success = false
			result.Error = err.Error()
			proposal.Status = "failed"
			go performRollback(proposal)
		} else {
			result.Success = true
			result.Message = "Patch applied successfully"
			proposal.Status = "applied"
			// Start monitoring for rollback
			go monitorFixHealth(proposal)
		}

	default:
		result.Success = false
		result.Error = "Unknown fix type"
		proposal.Status = "failed"
	}

	proposal.Result = result
	return result
}

// performRollback reverts a fix
func performRollback(proposal *AutoFixProposal) *FixResult {
	ctx := context.Background()
	result := &FixResult{
		Timestamp: time.Now(),
	}

	switch proposal.RollbackPlan.Strategy {
	case "revert_patch":
		if proposal.RollbackPlan.BackupPatch != "" {
			if err := applyPatch(ctx, proposal.Namespace, proposal.Name, proposal.Kind, proposal.RollbackPlan.BackupPatch, proposal.ClusterID); err != nil {
				result.Success = false
				result.Error = fmt.Sprintf("Rollback failed: %v", err)
			} else {
				result.Success = true
				result.Message = "Successfully rolled back to previous state"
				proposal.Status = "rolled_back"
			}
		} else {
			result.Success = false
			result.Error = "No backup patch available for rollback"
		}

	case "recreate":
		result.Success = true
		result.Message = "Rollback via recreation - manual verification required"
		proposal.Status = "rolled_back"

	default:
		result.Success = false
		result.Error = "Unknown rollback strategy"
	}

	return result
}

// monitorFixHealth watches for fix failure after application
func monitorFixHealth(proposal *AutoFixProposal) {
	// Wait for the specified timeout
	time.Sleep(time.Duration(proposal.RollbackPlan.Timeout) * time.Second)

	// Check if the fix is still in "applied" status
	if proposal.Status == "applied" {
		ctx := context.Background()
		// Check workload health
		healthy := checkWorkloadHealth(ctx, proposal.Namespace, proposal.Name, proposal.Kind, proposal.ClusterID)
		if !healthy {
			proposal.Result = &FixResult{
				Success:   false,
				Message:   "Fix health check failed - triggering rollback",
				Timestamp: time.Now(),
			}
			performRollback(proposal)
		}
	}
}

// restartDeployment performs a rolling restart
func restartDeployment(ctx context.Context, namespace, name, clusterID string) error {
	if k8s.Manager == nil {
		return fmt.Errorf("k8s manager not initialized")
	}

	for _, cluster := range k8s.Manager.ListClusters() {
		// Filter by cluster if specified
		if clusterID != "" && cluster.ID != clusterID {
			continue
		}
		if cluster.ClientSet == nil {
			continue
		}

		deployment, err := cluster.ClientSet.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			continue
		}

		// Trigger restart by updating an annotation
		if deployment.Spec.Template.Annotations == nil {
			deployment.Spec.Template.Annotations = make(map[string]string)
		}
		deployment.Spec.Template.Annotations["kubetriage.io/restartedAt"] = time.Now().Format(time.RFC3339)

		_, err = cluster.ClientSet.AppsV1().Deployments(namespace).Update(ctx, deployment, metav1.UpdateOptions{})
		return err
	}

	return fmt.Errorf("deployment not found")
}

// scaleDeployment scales a deployment
func scaleDeployment(ctx context.Context, namespace, name, clusterID string, replicas int32) error {
	if k8s.Manager == nil {
		return fmt.Errorf("k8s manager not initialized")
	}

	for _, cluster := range k8s.Manager.ListClusters() {
		// Filter by cluster if specified
		if clusterID != "" && cluster.ID != clusterID {
			continue
		}
		if cluster.ClientSet == nil {
			continue
		}

		deployment, err := cluster.ClientSet.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
		if err != nil {
			continue
		}

		deployment.Spec.Replicas = &replicas
		_, err = cluster.ClientSet.AppsV1().Deployments(namespace).Update(ctx, deployment, metav1.UpdateOptions{})
		return err
	}

	return fmt.Errorf("deployment not found")
}

// applyPatch applies a JSON merge patch
func applyPatch(ctx context.Context, namespace, name, kind, patch, clusterID string) error {
	if k8s.Manager == nil {
		return fmt.Errorf("k8s manager not initialized")
	}

	for _, cluster := range k8s.Manager.ListClusters() {
		// Filter by cluster if specified
		if clusterID != "" && cluster.ID != clusterID {
			continue
		}
		if cluster.ClientSet == nil {
			continue
		}

		// For Deployments
		if kind == "Deployment" || kind == "deployment" {
			_, err := cluster.ClientSet.AppsV1().Deployments(namespace).Patch(
				ctx, name, types.MergePatchType, []byte(patch), metav1.PatchOptions{})
			return err
		}
	}

	return fmt.Errorf("resource not found or unsupported kind: %s", kind)
}

// checkWorkloadHealth verifies a workload is healthy after a fix
func checkWorkloadHealth(ctx context.Context, namespace, name, kind, clusterID string) bool {
	if k8s.Manager == nil {
		return false
	}

	for _, cluster := range k8s.Manager.ListClusters() {
		// Filter by cluster if specified
		if clusterID != "" && cluster.ID != clusterID {
			continue
		}
		if cluster.ClientSet == nil {
			continue
		}

		if kind == "Deployment" || kind == "deployment" {
			deployment, err := cluster.ClientSet.AppsV1().Deployments(namespace).Get(ctx, name, metav1.GetOptions{})
			if err != nil {
				return false
			}

			// Check if deployment is healthy
			if deployment.Status.AvailableReplicas == deployment.Status.Replicas &&
				deployment.Status.Replicas > 0 {
				return true
			}

			// Check pods for errors
			pods, err := cluster.ClientSet.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{
				LabelSelector: fmt.Sprintf("app=%s", name),
			})
			if err != nil {
				return false
			}

			for _, pod := range pods.Items {
				if pod.Status.Phase == corev1.PodFailed {
					return false
				}
				for _, containerStatus := range pod.Status.ContainerStatuses {
					if containerStatus.State.Waiting != nil {
						reason := containerStatus.State.Waiting.Reason
						if reason == "CrashLoopBackOff" || reason == "ImagePullBackOff" || reason == "ErrImagePull" {
							return false
						}
					}
				}
			}
			return true
		}
	}

	return false
}
