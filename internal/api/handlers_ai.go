package api

import (
	"fmt"
	"log"
	"net/http"

	"strings" // Added for severity check

	"github.com/google/uuid"

	"github.com/aavishay/kubetriage/backend/internal/ai"
	"github.com/aavishay/kubetriage/backend/internal/auth" // Added for user info
	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/gin-gonic/gin"
)

type AIHandler struct {
	service *ai.AIService
}

func NewAIHandler(service *ai.AIService) *AIHandler {
	return &AIHandler{service: service}
}

func (h *AIHandler) AnalyzeWorkload(c *gin.Context) {
	var req ai.AnalyzeWorkloadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	analysis, err := h.service.AnalyzeWorkload(c.Request.Context(), req)
	if err != nil {
		log.Printf("Error analyzing workload: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to generate analysis: %v", err)})
		return
	}

	// 1. Detect Severity Heuristically
	severity := "Info"
	lowerAnalysis := strings.ToLower(analysis)
	if strings.Contains(lowerAnalysis, "critical") || strings.Contains(lowerAnalysis, "severe") {
		severity = "Critical"
	} else if strings.Contains(lowerAnalysis, "warning") || strings.Contains(lowerAnalysis, "high risk") {
		severity = "Warning"
	}

	// 2. Get User Project (if authenticated)
	var projectID *uuid.UUID
	if val, exists := c.Get("user"); exists {
		if userInfo, ok := val.(auth.UserInfo); ok {
			// Parse ProjectID string to UUID if valid
			if uid, err := uuid.Parse(userInfo.ProjectID); err == nil {
				projectID = &uid
			}
		}
	}

	// 3. Save to DB
	// 3. Save to DB
	clusterID := "local-cluster" // simplified for MVP
	report := db.TriageReport{
		ClusterID:    clusterID,
		WorkloadName: req.WorkloadName,
		Namespace:    req.Namespace,
		Kind:         req.Kind,
		Analysis:     analysis,
		Severity:     severity,
		ProjectID:    projectID,
		IsRead:       false,
	}

	if err := db.DB.Create(&report).Error; err != nil {
		log.Printf("Failed to save report: %v", err)
		// Proceed anyway, don't fail the request just because save failed (though ideally we should alert)
	}

	c.JSON(http.StatusOK, gin.H{"analysis": analysis, "reportId": report.ID})
}

func (h *AIHandler) GenerateRemediation(c *gin.Context) {
	var req GenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	suggestion, err := h.service.GenerateRemediation(c.Request.Context(), req.Provider, req.Model, req.ResourceKind, req.ResourceName, req.ErrorLog, req.Analysis)
	if err != nil {
		log.Printf("Error generating remediation: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate remediation"})
		return
	}

	c.JSON(http.StatusOK, suggestion)
}

func (h *AIHandler) GetModels(c *gin.Context) {
	provider := c.Query("provider")
	if provider == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider query parameter is required"})
		return
	}

	models, err := h.service.GetAvailableModels(c.Request.Context(), provider)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"models": models})
}

type GenerateTopologyRequest struct {
	Provider        string `json:"provider"`
	Model           string `json:"model"`
	WorkloadSummary string `json:"workloadSummary"`
}

func (h *AIHandler) GenerateTopology(c *gin.Context) {
	var req GenerateTopologyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	log.Printf("DEBUG: Received Topology Request. Provider: '%s', Model: '%s'", req.Provider, req.Model)

	diagram, err := h.service.GenerateTopology(c.Request.Context(), req.Provider, req.Model, req.WorkloadSummary)
	if err != nil {
		log.Printf("Error generating topology: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate topology"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"diagram": diagram})
}
