package db

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User model
type User struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Email       string    `gorm:"uniqueIndex;not null"`
	Provider    string    `gorm:"default:'local'"`
	ProviderID  string    `gorm:"index"`
	AvatarURL   string
	Role        string     `gorm:"default:'viewer'"`
	ProjectID   *uuid.UUID `gorm:"type:uuid"`
	Preferences []byte     `gorm:"type:jsonb"` // Stores JSON data for theme, etc.
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

// Session model for chat history
type Session struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID    *uuid.UUID `gorm:"type:uuid"` // Optional FK
	Messages  []byte     `gorm:"type:jsonb"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

// Playbook model for custom diagnostic recipes
type Playbook struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Name        string    `gorm:"not null"`
	Description string
	Prompt      string `gorm:"type:text;not null"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

type TriageReport struct {
	gorm.Model
	ClusterID    string
	Namespace    string
	WorkloadName string
	Kind         string
	Analysis     string     // Markdown analysis
	Severity     string     // Low, Medium, High, Critical
	IsRead       bool       `gorm:"default:false"`
	ProjectID    *uuid.UUID `gorm:"type:uuid"`
}

type AuditLog struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID    *uuid.UUID `gorm:"type:uuid"`
	UserEmail string
	Action    string
	Resource  string
	Details   string `gorm:"type:text"`
	IPAddress string
	CreatedAt time.Time
}

// Multi-Tenancy Models

type Project struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Name      string    `gorm:"not null"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

type ClusterProject struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	ClusterID string    `gorm:"uniqueIndex;not null"`
	ProjectID uuid.UUID `gorm:"not null"`
	CreatedAt time.Time
}
