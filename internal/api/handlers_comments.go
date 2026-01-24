package api

import (
	"log"
	"net/http"
	"strconv"

	"github.com/aavishay/kubetriage/backend/internal/auth"
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

	query := db.DB.Preload("User").Order("created_at asc")

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

	// Sanitize user info (remove email/PII if strictly robust, but internal tool is fine)
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

	// userInfo := c.MustGet("user").(auth.UserInfo)
	userIDStr := c.MustGet("userID").(string)
	userID, _ := uuid.Parse(userIDStr)

	comment := db.Comment{
		UserID:       userID,
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

	// Load User relationship for response
	db.DB.Model(&comment).Association("User").Find(&comment.User)

	// Ensure User struct fields are populated if standard eager load didn't work on create response (GORM quirk)
	if comment.User.Email == "" {
		// Manual fallback if needed, but Preload usually works on fetch not create return.
		// Doing a quick refetch to be safe for Frontend UI
		db.DB.Preload("User").First(&comment, comment.ID)
	}

	c.JSON(http.StatusOK, comment)
}

// DeleteCommentHandler deletes a comment if owner or admin
func DeleteCommentHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	userIDStr := c.MustGet("userID").(string)
	userInfo := c.MustGet("user").(auth.UserInfo)

	var comment db.Comment
	if err := db.DB.First(&comment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
		return
	}

	// Auth Check
	if comment.UserID.String() != userIDStr {
		// Check Admin
		if userInfo.Role != "admin" {
			log.Printf("Unauthorized delete attempt by %s on comment %s", userIDStr, idStr)
			c.JSON(http.StatusForbidden, gin.H{"error": "Not authorized"})
			return
		}
	}

	db.DB.Delete(&comment)
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}
