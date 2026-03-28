package api

import (
	"net/http"
	"strconv"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ListCommentsHandler returns comments based on query filters (reportID or cluster/ns/workload)
func ListCommentsHandler(c *gin.Context) {
	reportID := c.Query("reportID")
	clusterID := c.Query("clusterID")
	namespace := c.Query("namespace")
	workload := c.Query("workload")

	query := db.DB.Order("created_at asc")

	if reportID != "" {
		id, err := strconv.Atoi(reportID)
		if err == nil {
			query = query.Where("report_id = ?", id)
		}
	} else if clusterID != "" && namespace != "" && workload != "" {
		query = query.Where("cluster_id = ? AND namespace = ? AND workload_name = ?", clusterID, namespace, workload)
	} else {
		// If neither provided, return empty or bad request?
		// For MVP, return nothing
		c.JSON(http.StatusOK, []db.Comment{})
		return
	}

	var comments []db.Comment
	if err := query.Find(&comments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch comments"})
		return
	}

	c.JSON(http.StatusOK, comments)
}

// CreateCommentHandler creates a new comment
type CreateCommentRequest struct {
	Content      string `json:"content" binding:"required"`
	ReportID     *uint  `json:"reportId"`
	ClusterID    string `json:"clusterId"`
	Namespace    string `json:"namespace"`
	WorkloadName string `json:"workloadName"`
}

func CreateCommentHandler(c *gin.Context) {
	var req CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	comment := db.Comment{
		Author:       "local",
		Content:      req.Content,
		ReportID:     req.ReportID,
		ClusterID:    req.ClusterID,
		Namespace:    req.Namespace,
		WorkloadName: req.WorkloadName,
	}

	if err := db.DB.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to post comment"})
		return
	}

	c.JSON(http.StatusOK, comment)
}

// DeleteCommentHandler deletes a comment
func DeleteCommentHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var comment db.Comment
	if err := db.DB.First(&comment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
		return
	}

	db.DB.Delete(&comment)
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
