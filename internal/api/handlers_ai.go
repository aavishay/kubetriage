package api

import (
	"fmt"
	"log"
	"net/http"

	"github.com/aavishay/kubetriage/backend/internal/ai"
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

	c.JSON(http.StatusOK, gin.H{"analysis": analysis})
}

func (h *AIHandler) GenerateRemediation(c *gin.Context) {
	var req GenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	suggestion, err := h.service.GenerateRemediation(c.Request.Context(), req.Provider, req.Model, req.ResourceKind, req.ResourceName, req.ErrorLog)
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

	diagram, err := h.service.GenerateTopology(c.Request.Context(), req.Provider, req.Model, req.WorkloadSummary)
	if err != nil {
		log.Printf("Error generating topology: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate topology"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"diagram": diagram})
}
