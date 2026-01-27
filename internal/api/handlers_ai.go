package api

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/aavishay/kubetriage/backend/internal/ai"
	"github.com/aavishay/kubetriage/backend/internal/auth"
	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/aavishay/kubetriage/backend/internal/triage"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
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

	// --- ENRICHMENT START ---
	ctx := c.Request.Context()
	clusterID := c.Query("clusterId")
	var client *kubernetes.Clientset

	if clusterID != "" && k8s.Manager != nil {
		if cls, err := k8s.Manager.GetCluster(clusterID); err == nil {
			client = cls.ClientSet
		}
	}
	if client == nil {
		client = k8s.ClientSet
	}

	if client != nil && req.Namespace != "" && req.WorkloadName != "" {
		triage.EnrichAnalyzeRequest(ctx, client, &req)
	}
	// --- ENRICHMENT END ---

	analysis, err := h.service.AnalyzeWorkload(c.Request.Context(), req)
	if err != nil {
		log.Printf("Error analyzing workload: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to generate analysis: %v", err)})
		return
	}

	severity := "Info"
	lowerAnalysis := strings.ToLower(analysis)
	if strings.Contains(lowerAnalysis, "critical") || strings.Contains(lowerAnalysis, "severe") {
		severity = "Critical"
	} else if strings.Contains(lowerAnalysis, "warning") || strings.Contains(lowerAnalysis, "high risk") {
		severity = "Warning"
	}

	var projectID *uuid.UUID
	if val, exists := c.Get("user"); exists {
		if userInfo, ok := val.(auth.UserInfo); ok {
			if uid, err := uuid.Parse(userInfo.ProjectID); err == nil {
				projectID = &uid
			}
		}
	}

	reportClusterID := "local-cluster"
	report := db.TriageReport{
		ClusterID:    reportClusterID,
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
	}

	c.JSON(http.StatusOK, gin.H{
		"analysis": analysis,
		"reportId": report.ID,
		"context":  req,
	})
}

func (h *AIHandler) GenerateRemediation(c *gin.Context) {
	var req GenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	clusterID := c.Query("clusterId")
	var client *kubernetes.Clientset

	if clusterID != "" && k8s.Manager != nil {
		if cls, err := k8s.Manager.GetCluster(clusterID); err == nil {
			client = cls.ClientSet
		}
	}
	if client == nil {
		client = k8s.ClientSet
	}

	currentImages := ""
	if client != nil {
		switch req.ResourceKind {
		case "Deployment":
			if d, err := client.AppsV1().Deployments(req.Namespace).Get(ctx, req.ResourceName, metav1.GetOptions{}); err == nil {
				for _, c := range d.Spec.Template.Spec.Containers {
					currentImages += fmt.Sprintf("Container '%s': %s\n", c.Name, c.Image)
				}
			}
		case "StatefulSet":
			if s, err := client.AppsV1().StatefulSets(req.Namespace).Get(ctx, req.ResourceName, metav1.GetOptions{}); err == nil {
				for _, c := range s.Spec.Template.Spec.Containers {
					currentImages += fmt.Sprintf("Container '%s': %s\n", c.Name, c.Image)
				}
			}
		case "DaemonSet":
			if d, err := client.AppsV1().DaemonSets(req.Namespace).Get(ctx, req.ResourceName, metav1.GetOptions{}); err == nil {
				for _, c := range d.Spec.Template.Spec.Containers {
					currentImages += fmt.Sprintf("Container '%s': %s\n", c.Name, c.Image)
				}
			}
		}
	}

	suggestion, err := h.service.GenerateRemediation(c.Request.Context(), req.Provider, req.Model, req.ResourceKind, req.ResourceName, req.ErrorLog, req.Analysis, currentImages)
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

	// Fetch Active Incidents for Reactive Styling
	var activeReports []db.TriageReport
	incidentSummary := ""
	if err := db.DB.Where("is_read = ?", false).Find(&activeReports).Error; err == nil {
		for _, r := range activeReports {
			incidentSummary += fmt.Sprintf("- %s in %s: %s (Severity: %s)\n", r.WorkloadName, r.Namespace, r.IncidentType, r.Severity)
		}
	}

	diagram, err := h.service.GenerateTopology(c.Request.Context(), req.Provider, req.Model, req.WorkloadSummary, incidentSummary)
	if err != nil {
		log.Printf("Error generating topology: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate topology"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"diagram": diagram})
}

type ChatRequest struct {
	Provider string           `json:"provider"`
	Model    string           `json:"model"`
	History  []ai.ChatMessage `json:"history"`
	Message  string           `json:"message"`
}

func (h *AIHandler) Chat(c *gin.Context) {
	var req ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	response, err := h.service.Chat(c.Request.Context(), req.Provider, req.Model, req.History, req.Message)
	if err != nil {
		log.Printf("Chat error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate chat response"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"response": response})
}
