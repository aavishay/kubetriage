package api

import (
	"fmt"
	"log"
	"net/http"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/aavishay/kubetriage/backend/internal/integrations"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func ListReportsHandler(c *gin.Context) {
	var reports []db.TriageReport
	// Only fetch unread by default, or all if ?all=true
	query := db.DB.Order("created_at desc")
	if c.Query("all") != "true" && c.Query("workloadName") == "" {
		query = query.Where("is_read = ?", false)
	}

	workloadName := c.Query("workloadName")
	if workloadName != "" {
		query = query.Where("workload_name = ?", workloadName)
	}

	if err := query.Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reports"})
		return
	}

	c.JSON(http.StatusOK, reports)
}

func MarkReportReadHandler(c *gin.Context) {
	id := c.Param("id")
	if err := db.DB.Model(&db.TriageReport{}).Where("id = ?", id).Update("is_read", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update report"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func DeleteAllReportsHandler(c *gin.Context) {
	if err := db.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&db.TriageReport{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete reports archive"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "Archive cleaned successfully"})
}

func GenerateComplianceReportHandler(c *gin.Context) {
	// Simplified: Return error as single-user compliance logging is TBD
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Compliance reports are disabled in single-user mode"})
}

func ExportReportHandler(c *gin.Context) {
	id := c.Param("id")
	target := c.Query("target") // "slack" or "jira"

	var report db.TriageReport
	if err := db.DB.First(&report, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Report not found"})
		return
	}

	if target == "slack" {
		// Call slack integration
		title := fmt.Sprintf("KubeTriage Alert: %s (%s)", report.WorkloadName, report.IncidentType)
		message := report.Analysis

		// Integration call
		go integrations.SendSlackAlert(title, message, report.Severity, nil)

		log.Printf("Exporting Report %s to Slack\n", id)
		c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "Exported to Slack"})
		return
	}

	if target == "jira" {
		// Mock Jira export
		fmt.Printf("MOCK: Exporting Report %s to Jira\n", id)
		c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "Jira ticket created: KT-1234 (Mocked)"})
		return
	}

	c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid export target"})
}
