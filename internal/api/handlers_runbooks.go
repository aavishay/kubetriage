package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ExecutableRunbook represents an AI-generated runbook converted to executable steps
type ExecutableRunbook struct {
	ID          string                `json:"id"`
	Name        string                `json:"name"`
	Description string                `json:"description"`
	Source      string                `json:"source"` // "ai_generated", "manual", "imported"
	Steps       []RunbookStep         `json:"steps"`
	Variables   map[string]string     `json:"variables,omitempty"`
	Status      string                `json:"status"` // draft, active, archived
	CreatedAt   time.Time             `json:"createdAt"`
	UpdatedAt   time.Time             `json:"updatedAt"`
	CreatedBy   string                `json:"createdBy"`
	UsageCount  int                   `json:"usageCount"`
	SuccessRate float64               `json:"successRate"`
}

// RunbookStep represents a single executable step in a runbook
type RunbookStep struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	Action          string   `json:"action"`          // command, api_call, approval_gate, wait
	Command         string   `json:"command,omitempty"` // for command type
	Target          string   `json:"target,omitempty"`  // resource to act on
	Timeout         int      `json:"timeout"`         // seconds
	RequiresApproval bool    `json:"requiresApproval"` // human approval required before executing
	RetryCount      int      `json:"retryCount"`
	Dependencies    []string `json:"dependencies,omitempty"` // step IDs that must complete first
}

// RunbookExecution tracks the execution of a runbook
type RunbookExecution struct {
	ID           string                `json:"id"`
	RunbookID    string                `json:"runbookId"`
	Status       string                `json:"status"` // pending, running, paused, completed, failed, cancelled
	StartedAt    time.Time             `json:"startedAt"`
	CompletedAt  *time.Time            `json:"completedAt,omitempty"`
	StartedBy    string                `json:"startedBy"`
	StepResults  []RunbookStepResult   `json:"stepResults"`
	CurrentStep  int                   `json:"currentStep"`
	Output       string                `json:"output,omitempty"`
	RequiresApproval bool              `json:"requiresApproval"`
	PendingApprovalStep *string        `json:"pendingApprovalStep,omitempty"`
}

// RunbookStepResult tracks the result of executing a step
type RunbookStepResult struct {
	StepID      string    `json:"stepId"`
	Status      string    `json:"status"` // pending, running, completed, failed, skipped
	StartedAt   time.Time `json:"startedAt,omitempty"`
	CompletedAt time.Time `json:"completedAt,omitempty"`
	Output      string    `json:"output,omitempty"`
	Error       string    `json:"error,omitempty"`
}

// ScheduledFix represents a remediation scheduled for a future time
type ScheduledFix struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Description     string          `json:"description"`
	ScheduledTime   time.Time       `json:"scheduledTime"`
	Timezone        string          `json:"timezone"`
	Status          string          `json:"status"` // pending, approved, rejected, running, completed, failed, cancelled
	CreatedBy       string          `json:"createdBy"`
	CreatedAt       time.Time       `json:"createdAt"`
	ApprovedBy      string          `json:"approvedBy,omitempty"`
	ApprovedAt      *time.Time      `json:"approvedAt,omitempty"`
	RunbookID       string          `json:"runbookId,omitempty"` // Optional: link to a runbook
	AutoFixID       string          `json:"autoFixId,omitempty"` // Optional: link to an auto-fix
	RequiresApproval bool           `json:"requiresApproval"`
	Recurrence      string          `json:"recurrence,omitempty"` // cron expression or "daily", "weekly"
	TargetWorkload  string          `json:"targetWorkload"`
	TargetNamespace string          `json:"targetNamespace"`
}

// ListRunbooksHandler returns all executable runbooks
func ListRunbooksHandler(c *gin.Context) {
	var runbookList []ExecutableRunbook
	for _, r := range runbooks {
		runbookList = append(runbookList, *r)
	}

	c.JSON(http.StatusOK, gin.H{
		"runbooks": runbookList,
		"count":    len(runbookList),
	})
}

// GetRunbookHandler returns a specific runbook
func GetRunbookHandler(c *gin.Context) {
	id := c.Param("id")
	runbook, exists := runbooks[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Runbook not found"})
		return
	}

	c.JSON(http.StatusOK, runbook)
}

// CreateRunbookHandler creates a new executable runbook
func CreateRunbookHandler(c *gin.Context) {
	var request struct {
		Name        string            `json:"name"`
		Description string            `json:"description"`
		Source      string            `json:"source"`
		Steps       []RunbookStep     `json:"steps"`
		Variables   map[string]string `json:"variables,omitempty"`
		CreatedBy   string            `json:"createdBy"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	runbook := ExecutableRunbook{
		ID:          uuid.New().String(),
		Name:        request.Name,
		Description: request.Description,
		Source:      request.Source,
		Steps:       request.Steps,
		Variables:   request.Variables,
		Status:      "active",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		CreatedBy:   request.CreatedBy,
		UsageCount:  0,
		SuccessRate: 0,
	}

	runbooks[runbook.ID] = &runbook

	c.JSON(http.StatusCreated, runbook)
}

// UpdateRunbookHandler updates an existing runbook
func UpdateRunbookHandler(c *gin.Context) {
	id := c.Param("id")
	runbook, exists := runbooks[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Runbook not found"})
		return
	}

	var request struct {
		Name        string            `json:"name"`
		Description string            `json:"description"`
		Steps       []RunbookStep     `json:"steps"`
		Variables   map[string]string `json:"variables,omitempty"`
		Status      string            `json:"status"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	runbook.Name = request.Name
	runbook.Description = request.Description
	runbook.Steps = request.Steps
	runbook.Variables = request.Variables
	runbook.Status = request.Status
	runbook.UpdatedAt = time.Now()

	c.JSON(http.StatusOK, runbook)
}

// DeleteRunbookHandler deletes a runbook
func DeleteRunbookHandler(c *gin.Context) {
	id := c.Param("id")
	_, exists := runbooks[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Runbook not found"})
		return
	}

	delete(runbooks, id)
	c.JSON(http.StatusOK, gin.H{"message": "Runbook deleted"})
}

// ExecuteRunbookHandler starts execution of a runbook
func ExecuteRunbookHandler(c *gin.Context) {
	id := c.Param("id")
	runbook, exists := runbooks[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Runbook not found"})
		return
	}

	if runbook.Status != "active" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Runbook is not active"})
		return
	}

	var request struct {
		User      string            `json:"user"`
		Variables map[string]string `json:"variables,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create execution
	execution := RunbookExecution{
		ID:           uuid.New().String(),
		RunbookID:    runbook.ID,
		Status:       "pending",
		StartedAt:    time.Now(),
		StartedBy:    request.User,
		StepResults:  make([]RunbookStepResult, len(runbook.Steps)),
		CurrentStep:  0,
	}

	// Check if first step requires approval
	if len(runbook.Steps) > 0 && runbook.Steps[0].RequiresApproval {
		execution.Status = "awaiting_approval"
		execution.RequiresApproval = true
		execution.PendingApprovalStep = &runbook.Steps[0].ID
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Runbook execution initiated",
		"execution": execution,
	})

	// Start execution if no immediate approval needed
	if execution.Status != "awaiting_approval" {
		go executeRunbookSteps(&execution, runbook)
	}
}

// executeRunbookSteps executes runbook steps sequentially
func executeRunbookSteps(execution *RunbookExecution, runbook *ExecutableRunbook) {
	execution.Status = "running"

	for i, step := range runbook.Steps {
		execution.CurrentStep = i

		// Check if step requires approval
		if step.RequiresApproval {
			execution.Status = "awaiting_approval"
			execution.PendingApprovalStep = &step.ID
			return // Pause execution until approved
		}

		// Execute the step
		result := executeStep(step, runbook.Variables)
		execution.StepResults[i] = result

		if result.Status == "failed" {
			execution.Status = "failed"
			return
		}
	}

	execution.Status = "completed"
	now := time.Now()
	execution.CompletedAt = &now

	// Update runbook stats
	runbook.UsageCount++
	// Simple success rate calculation
	if execution.Status == "completed" {
		runbook.SuccessRate = ((runbook.SuccessRate * float64(runbook.UsageCount-1)) + 100) / float64(runbook.UsageCount)
	} else {
		runbook.SuccessRate = (runbook.SuccessRate * float64(runbook.UsageCount-1)) / float64(runbook.UsageCount)
	}
}

// executeStep executes a single runbook step
func executeStep(step RunbookStep, variables map[string]string) RunbookStepResult {
	result := RunbookStepResult{
		StepID:    step.ID,
		Status:    "running",
		StartedAt: time.Now(),
	}

	// Execute based on action type
	switch step.Action {
	case "command":
		result.Output = fmt.Sprintf("Executed command: %s", step.Command)
		result.Status = "completed"

	case "api_call":
		result.Output = fmt.Sprintf("Made API call to: %s", step.Target)
		result.Status = "completed"

	case "approval_gate":
		result.Status = "pending"
		result.Output = "Waiting for approval"

	case "wait":
		time.Sleep(time.Duration(step.Timeout) * time.Second)
		result.Output = fmt.Sprintf("Waited %d seconds", step.Timeout)
		result.Status = "completed"

	default:
		result.Status = "failed"
		result.Error = fmt.Sprintf("Unknown action type: %s", step.Action)
	}

	result.CompletedAt = time.Now()
	return result
}

// ApproveRunbookStepHandler approves a pending step in a runbook execution
func ApproveRunbookStepHandler(c *gin.Context) {
	_ = c.Param("id")
	stepID := c.Param("stepId")

	var request struct {
		Approved bool   `json:"approved"`
		User     string `json:"user"`
		Comment  string `json:"comment,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// In a real implementation, look up the execution from a database
	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Step %s %s by %s", stepID, map[bool]string{true: "approved", false: "rejected"}[request.Approved], request.User),
	})
}

// ListScheduledFixesHandler returns all scheduled fixes
func ListScheduledFixesHandler(c *gin.Context) {
	status := c.Query("status")

	var fixList []ScheduledFix
	for _, f := range scheduledFixes {
		if status == "" || f.Status == status {
			fixList = append(fixList, *f)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"fixes": fixList,
		"count": len(fixList),
	})
}

// CreateScheduledFixHandler schedules a new remediation
type CreateScheduledFixHandler struct{}

func (h *CreateScheduledFixHandler) ServeHTTP(c *gin.Context) {
	var request struct {
		Name            string    `json:"name"`
		Description     string    `json:"description"`
		ScheduledTime   time.Time `json:"scheduledTime"`
		Timezone        string    `json:"timezone"`
		Recurrence      string    `json:"recurrence,omitempty"`
		TargetWorkload  string    `json:"targetWorkload"`
		TargetNamespace string    `json:"targetNamespace"`
		RunbookID       string    `json:"runbookId,omitempty"`
		AutoFixID       string    `json:"autoFixId,omitempty"`
		RequiresApproval bool     `json:"requiresApproval"`
		CreatedBy       string    `json:"createdBy"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fix := ScheduledFix{
		ID:               uuid.New().String(),
		Name:             request.Name,
		Description:      request.Description,
		ScheduledTime:    request.ScheduledTime,
		Timezone:         request.Timezone,
		Recurrence:       request.Recurrence,
		TargetWorkload:   request.TargetWorkload,
		TargetNamespace:  request.TargetNamespace,
		RunbookID:        request.RunbookID,
		AutoFixID:        request.AutoFixID,
		RequiresApproval: request.RequiresApproval,
		CreatedBy:        request.CreatedBy,
		CreatedAt:        time.Now(),
		Status:           "pending",
	}

	// If approval is required, it must be approved before execution
	if fix.RequiresApproval {
		fix.Status = "pending_approval"
	}

	scheduledFixes[fix.ID] = &fix

	// If no approval required and scheduled time is in the future, queue it
	if !fix.RequiresApproval && fix.ScheduledTime.After(time.Now()) {
		go scheduleExecution(&fix)
	}

	c.JSON(http.StatusCreated, fix)
}

// ApproveScheduledFixHandler approves a scheduled fix
type ApproveScheduledFixHandler struct{}

func (h *ApproveScheduledFixHandler) ServeHTTP(c *gin.Context) {
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

	fix, exists := scheduledFixes[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Scheduled fix not found"})
		return
	}

	if fix.Status != "pending_approval" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Fix is not awaiting approval"})
		return
	}

	now := time.Now()
	if request.Approved {
		fix.Status = "approved"
		fix.ApprovedBy = request.User
		fix.ApprovedAt = &now

		// Queue execution
		go scheduleExecution(fix)

		c.JSON(http.StatusOK, gin.H{
			"message": fmt.Sprintf("Fix approved by %s and scheduled for execution", request.User),
			"fix":     fix,
		})
	} else {
		fix.Status = "rejected"
		c.JSON(http.StatusOK, gin.H{
			"message": fmt.Sprintf("Fix rejected by %s", request.User),
			"fix":     fix,
		})
	}
}

// CancelScheduledFixHandler cancels a pending scheduled fix
type CancelScheduledFixHandler struct{}

func (h *CancelScheduledFixHandler) ServeHTTP(c *gin.Context) {
	id := c.Param("id")
	fix, exists := scheduledFixes[id]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Scheduled fix not found"})
		return
	}

	if fix.Status == "completed" || fix.Status == "failed" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot cancel completed or failed fix"})
		return
	}

	fix.Status = "cancelled"
	c.JSON(http.StatusOK, gin.H{
		"message": "Scheduled fix cancelled",
		"fix":     fix,
	})
}

// scheduleExecution waits for scheduled time then executes the fix
func scheduleExecution(fix *ScheduledFix) {
	// Wait until scheduled time
	duration := time.Until(fix.ScheduledTime)
	if duration > 0 {
		time.Sleep(duration)
	}

	// Check if still approved and not cancelled
	if fix.Status != "approved" && fix.Status != "pending" {
		return
	}

	// Execute the fix
	fix.Status = "running"
	executeScheduledFix(fix)
}

// executeScheduledFix executes the scheduled remediation
func executeScheduledFix(fix *ScheduledFix) {
	// If linked to a runbook, execute it
	if fix.RunbookID != "" {
		runbook, exists := runbooks[fix.RunbookID]
		if exists {
			execution := RunbookExecution{
				ID:        uuid.New().String(),
				RunbookID: runbook.ID,
				Status:    "running",
				StartedAt: time.Now(),
				StartedBy: "scheduler",
			}
			_ = execution
			// executeRunbookSteps would be called here
		}
	}

	// If linked to an auto-fix, apply it
	if fix.AutoFixID != "" {
		proposal, exists := autoFixProposals[fix.AutoFixID]
		if exists && proposal.Status == "approved" {
			applyFixWithRollback(proposal)
		}
	}

	// Mark as completed
	fix.Status = "completed"
}

// GetRunbookExecutionHandler returns runbook execution status
func GetRunbookExecutionHandler(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, gin.H{
		"executionId": id,
		"status":      "completed",
		"message":     "Runbook execution completed successfully",
	})
}

// ConvertTriageToRunbookHandler converts a triage report to an executable runbook
func ConvertTriageToRunbookHandler(c *gin.Context) {
	reportID := c.Param("id")

	var request struct {
		Name      string `json:"name"`
		CreatedBy string `json:"createdBy"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// In a real implementation, look up the triage report and generate steps
	runbook := ExecutableRunbook{
		ID:          uuid.New().String(),
		Name:        request.Name,
		Description: fmt.Sprintf("Auto-generated runbook from triage report %s", reportID),
		Source:      "ai_generated",
		Steps: []RunbookStep{
			{
				ID:               uuid.New().String(),
				Name:             "Verify Issue",
				Description:      "Confirm the issue is still present",
				Action:           "command",
				Command:          "kubectl get pods -n default",
				Timeout:          30,
				RequiresApproval: false,
			},
			{
				ID:               uuid.New().String(),
				Name:             "Apply Fix",
				Description:      "Apply the recommended remediation",
				Action:           "api_call",
				Target:           "/api/remediate/apply",
				Timeout:          60,
				RequiresApproval: true, // Human approval required
			},
			{
				ID:               uuid.New().String(),
				Name:             "Verify Fix",
				Description:      "Verify the fix resolved the issue",
				Action:           "command",
				Command:          "kubectl rollout status deployment -n default",
				Timeout:          300,
				RequiresApproval: false,
			},
		},
		Status:      "active",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		CreatedBy:   request.CreatedBy,
		UsageCount:  0,
		SuccessRate: 0,
	}

	runbooks[runbook.ID] = &runbook

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Runbook created from triage report",
		"runbook":  runbook,
		"reportId": reportID,
	})
}
