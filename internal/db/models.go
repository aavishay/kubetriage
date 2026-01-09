package db

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User model
type User struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey"`
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

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return
}

// Session model for chat history
type Session struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey"`
	UserID    *uuid.UUID `gorm:"type:uuid"` // Optional FK
	Messages  []byte     `gorm:"type:jsonb"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

func (s *Session) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return
}

// Playbook model for custom diagnostic recipes
type Playbook struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey"`
	Name        string    `gorm:"not null"`
	Description string
	Prompt      string `gorm:"type:text;not null"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

func (p *Playbook) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return
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
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey"`
	UserID    *uuid.UUID `gorm:"type:uuid"`
	UserEmail string
	Action    string
	Resource  string
	Details   string `gorm:"type:text"`
	IPAddress string
	CreatedAt time.Time
}

func (a *AuditLog) BeforeCreate(tx *gorm.DB) (err error) {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return
}

// Multi-Tenancy Models

type Project struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey"`
	Name      string    `gorm:"not null"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

func (p *Project) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return
}

type ClusterProject struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey"`
	ClusterID string    `gorm:"uniqueIndex;not null"`
	ProjectID uuid.UUID `gorm:"not null"`
	CreatedAt time.Time
}

func (cp *ClusterProject) BeforeCreate(tx *gorm.DB) (err error) {
	if cp.ID == uuid.Nil {
		cp.ID = uuid.New()
	}
	return
}
