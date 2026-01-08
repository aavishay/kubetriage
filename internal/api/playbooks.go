package api

import (
	"net/http"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CreatePlaybookRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Prompt      string `json:"prompt" binding:"required"`
}

type UpdatePlaybookRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Prompt      string `json:"prompt"`
}

func ListPlaybooksHandler(c *gin.Context) {
	var playbooks []db.Playbook
	if result := db.DB.Find(&playbooks); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, playbooks)
}

func CreatePlaybookHandler(c *gin.Context) {
	var req CreatePlaybookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	playbook := db.Playbook{
		Name:        req.Name,
		Description: req.Description,
		Prompt:      req.Prompt,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if result := db.DB.Create(&playbook); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusCreated, playbook)
}

func UpdatePlaybookHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid UUID"})
		return
	}

	var playbook db.Playbook
	if result := db.DB.First(&playbook, "id = ?", id); result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Playbook not found"})
		return
	}

	var req UpdatePlaybookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	playbook.Name = req.Name
	playbook.Description = req.Description
	playbook.Prompt = req.Prompt
	playbook.UpdatedAt = time.Now()

	if result := db.DB.Save(&playbook); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, playbook)
}

func DeletePlaybookHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid UUID"})
		return
	}

	if result := db.DB.Delete(&db.Playbook{}, "id = ?", id); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
