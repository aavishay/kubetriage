package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/auth"
	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
)

func ListReportsHandler(c *gin.Context) {
	var reports []db.TriageReport
	// Only fetch unread by default, or all if ?all=true
	query := db.DB.Order("created_at desc")
	if c.Query("all") != "true" {
		query = query.Where("is_read = ?", false)
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

func GenerateComplianceReportHandler(c *gin.Context) {
	// 1. Get Context
	userInfo := c.MustGet("user").(auth.UserInfo)
	projectID := c.Query("project_id")

	// Security: User can only request report for their own project (unless Admin)
	if userInfo.Role != auth.RoleAdmin {
		if projectID != "" && projectID != userInfo.ProjectID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: Cannot access other project's reports"})
			return
		}
		// Default to user's project
		projectID = userInfo.ProjectID
	}

	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Project ID is required"})
		return
	}

	// 2. Fetch Data (Audit Logs for Users in this Project)
	var logs []db.AuditLog
	// Join with Users to filter by ProjectID
	err := db.DB.Joins("JOIN users ON users.id = audit_logs.user_id").
		Where("users.project_id = ?", projectID).
		Order("audit_logs.created_at DESC").
		Limit(100). // Cap for performance for now
		Find(&logs).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}

	// 3. Generate PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(40, 10, "Compliance Report: Audit Logs")
	pdf.Ln(12)

	pdf.SetFont("Arial", "", 12)
	pdf.Cell(0, 10, fmt.Sprintf("Project ID: %s", projectID))
	pdf.Ln(8)
	pdf.Cell(0, 10, fmt.Sprintf("Generated At: %s", time.Now().Format(time.RFC3339)))
	pdf.Ln(20)

	// Table Header
	pdf.SetFont("Arial", "B", 10)
	pdf.CellFormat(50, 8, "Timestamp", "1", 0, "", false, 0, "")
	pdf.CellFormat(40, 8, "User", "1", 0, "", false, 0, "")
	pdf.CellFormat(30, 8, "Action", "1", 0, "", false, 0, "")
	pdf.CellFormat(70, 8, "Details", "1", 0, "", false, 0, "")
	pdf.Ln(-1)

	// Table Body
	pdf.SetFont("Arial", "", 9)
	for _, l := range logs {
		pdf.CellFormat(50, 8, l.CreatedAt.Format("2006-01-02 15:04:05"), "1", 0, "", false, 0, "")
		pdf.CellFormat(40, 8, l.UserEmail, "1", 0, "", false, 0, "")
		pdf.CellFormat(30, 8, l.Action, "1", 0, "", false, 0, "")

		// Truncate details details to fit
		details := l.Details
		if len(details) > 40 {
			details = details[:37] + "..."
		}
		pdf.CellFormat(70, 8, details, "1", 0, "", false, 0, "")
		pdf.Ln(-1)
	}

	// 4. Return PDF
	c.Header("Content-Disposition", "attachment; filename=compliance_report.pdf")
	c.Header("Content-Type", "application/pdf")
	if err := pdf.Output(c.Writer); err != nil {
		// If we already wrote headers, we can't do much but log
		fmt.Printf("Error generating PDF: %v\n", err)
	}
}
