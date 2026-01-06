package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// Constants for roles
const (
	RoleAdmin    = "admin"
	RoleReadOnly = "readonly"
)

// UserContextKey is the key used to store user info in context
const UserContextKey = "user"

// UserInfo struct
type UserInfo struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

// AuthMiddleware extracts user identity
// For now, it mocks an Admin user for dev purposes
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")

		// Development Mode: If no header or specific mock header, inject Admin
		// In production, this would be replaced by real JWT validation
		if authHeader == "" || strings.HasPrefix(authHeader, "Bearer mock-token") {
			user := UserInfo{
				ID:    "dev-admin-id",
				Email: "admin@kubetriage.com",
				Role:  RoleAdmin,
			}
			c.Set(UserContextKey, user)
			c.Next()
			return
		}

		// If real auth was implemented, we would validate token here
		// c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})

		// Fallback for now to allow dev
		c.Next()
	}
}

// RequireRole middleware enforces RBAC
func RequireRole(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, exists := c.Get(UserContextKey)
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		userInfo, ok := user.(UserInfo)
		if !ok {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Invalid user context"})
			return
		}

		// Simple RBAC: Admin can do everything
		if userInfo.Role == RoleAdmin {
			c.Next()
			return
		}

		if userInfo.Role != requiredRole {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}

		c.Next()
	}
}
