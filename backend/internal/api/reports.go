package api

import (
	"net/http"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/gin-gonic/gin"
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
