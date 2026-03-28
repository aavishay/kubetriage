package db

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Session model for chat history
type Session struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey"`
	Messages  []byte    `gorm:"type:jsonb"`
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
	ClusterID              string
	Namespace              string
	WorkloadName           string
	Kind                   string
	Analysis               string // Markdown analysis
	Severity               string // Low, Medium, High, Critical
	IsRead                 bool   `gorm:"default:false"`
	IncidentType           string // e.g., "CrashLoopBackOff", "OOMKilled"
	AutoRemediationPayload string `gorm:"type:text"`      // JSON/YAML patch
	ApprovalStatus         string `gorm:"default:'None'"` // Pending, Approved, Rejected, None
}

// Comment model for Incident Comments
type Comment struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey"`
	Author       string    `gorm:"type:varchar(100);not null"` // Replaces User relationship
	Content      string    `gorm:"type:text;not null"`
	ReportID     *uint     `gorm:"index"` // Link to TriageReport (uint ID from gorm.Model)
	ClusterID    string    `gorm:"index"` // Link to Workload (Cluster)
	Namespace    string    `gorm:"index"` // Link to Workload (Namespace)
	WorkloadName string    `gorm:"index"` // Link to Workload (Name)
	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    gorm.DeletedAt `gorm:"index"`
}

func (c *Comment) BeforeCreate(tx *gorm.DB) (err error) {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return
}

// Recipe model for Automation Engine (Phase 2)
type Recipe struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey"`
	Name          string    `gorm:"not null"`
	Description   string
	TriggerType   string // e.g., "Metric", "Event", "PodStatus", "Security"
	TriggerConfig string // JSON config for the trigger
	ActionType    string // e.g., "Report", "Remediate"
	IsEnabled     bool   `gorm:"default:true"`
	CreatedAt     time.Time
	UpdatedAt     time.Time
	DeletedAt     gorm.DeletedAt `gorm:"index"`
}

func (r *Recipe) BeforeCreate(tx *gorm.DB) (err error) {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return
}
