package api

import (
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate analysis"})
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

	suggestion, err := h.service.GenerateRemediation(c.Request.Context(), req.ResourceKind, req.ResourceName, req.ErrorLog)
	if err != nil {
		log.Printf("Error generating remediation: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate remediation"})
		return
	}

	c.JSON(http.StatusOK, suggestion)
}
