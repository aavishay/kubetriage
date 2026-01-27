package api

import (
	"net/http"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func ListRecipesHandler(c *gin.Context) {
	var recipes []db.Recipe
	if result := db.DB.Find(&recipes); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	c.JSON(http.StatusOK, recipes)
}

func ToggleRecipeHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid UUID"})
		return
	}

	var recipe db.Recipe
	if result := db.DB.First(&recipe, "id = ?", id); result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Recipe not found"})
		return
	}

	recipe.IsEnabled = !recipe.IsEnabled
	recipe.UpdatedAt = time.Now()

	if result := db.DB.Save(&recipe); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusOK, recipe)
}
