package api

import (
	"net/http"

	"github.com/aavishay/kubetriage/backend/internal/auth"
	"github.com/gin-gonic/gin"
)

// MeHandler returns the current authenticated user
func MeHandler(c *gin.Context) {
	user, exists := c.Get(auth.UserContextKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	c.JSON(http.StatusOK, user)
}
