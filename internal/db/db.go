package db

import (
	"log"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB(dsn string) (*gorm.DB, error) {
	var err error
	if dsn == "" {
		log.Println("No DATABASE_URL provided, skipping DB init")
		return nil, nil
	}

	var dialector gorm.Dialector

	// Determine Driver
	if strings.Contains(dsn, "host=") || strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		log.Println("Initializing Postgres Database...")
		dialector = postgres.Open(dsn)
	} else {
		log.Printf("Initializing SQLite Database at %s...", dsn)
		// Enable WAL mode via DSN query params for pure Go driver?
		// Actually, glebarez/sqlite supports pragmas in connection, or we can execute raw SQL after open.
		// DSN format: file:test.db?cache=shared&_pragma=journal_mode(wal)
		if !strings.Contains(dsn, "?") {
			dsn += "?_pragma=journal_mode(wal)&_pragma=busy_timeout(5000)"
		}
		dialector = sqlite.Open(dsn)
	}

	// Retry logic for DB connection (mostly for Postgres containers)
	for i := 0; i < 10; i++ {
		DB, err = gorm.Open(dialector, &gorm.Config{})
		if err == nil {
			log.Println("Connected to Database")
			break
		}

		// If SQLite fails, it's usually permission or path, retrying won't help much but harmless.
		// For Postgres, it helps wait for container.
		if strings.Contains(err.Error(), "no such host") || strings.Contains(err.Error(), "connection refused") {
			log.Printf("Fast-failing DB connection due to permanent error: %v", err)
			break
		}

		log.Printf("Failed to connect to DB, retrying in 2s... (%d/10) Error: %v", i+1, err)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		return nil, err
	}

	// Auto-Migrate Schemas
	err = DB.AutoMigrate(&User{}, &Session{}, &Playbook{}, &TriageReport{}, &AuditLog{}, &Project{}, &ClusterProject{}, &Comment{}, &Recipe{})
	if err != nil {
		log.Printf("Warning: AutoMigrate failed: %v", err)
	}

	// Seed Default Project
	go seedDefaultProject(DB)
	go seedDefaultRecipes(DB)

	return DB, nil
}

func seedDefaultRecipes(db *gorm.DB) {
	var count int64
	db.Model(&Recipe{}).Count(&count)
	if count > 0 {
		return
	}

	recipes := []Recipe{
		{
			Name:          "Rapid CrashLoop Detection",
			Description:   "Detects pods with high restart counts (>5) and flags for remediation.",
			TriggerType:   "PodStatus",
			TriggerConfig: `{"restart_threshold": 5}`,
			ActionType:    "Report",
			IsEnabled:     true,
		},
		{
			Name:          "Privileged Container Check",
			Description:   "Scans for containers running in privileged mode (CIS Benchmark).",
			TriggerType:   "Security",
			TriggerConfig: `{"check": "privileged"}`,
			ActionType:    "Report",
			IsEnabled:     true,
		},
		{
			Name:          "Root User Execution",
			Description:   "Checks if workloads are allowed to run as root.",
			TriggerType:   "Security",
			TriggerConfig: `{"check": "runAsRoot"}`,
			ActionType:    "Report",
			IsEnabled:     true,
		},
		{
			Name:          "Stalled Deployment",
			Description:   "Identifies deployments where available replicas < requested replicas.",
			TriggerType:   "PodStatus",
			TriggerConfig: `{"check": "availability"}`,
			ActionType:    "Report",
			IsEnabled:     true,
		},
		{
			Name:          "High CPU Saturation",
			Description:   "Alerts when a Pod consumes more than 1.0 CPU core (cluster-wide).",
			TriggerType:   "Metric",
			TriggerConfig: `sum(rate(container_cpu_usage_seconds_total{container!=""}[5m])) by (namespace, pod) > 1.0`,
			ActionType:    "Report",
			IsEnabled:     true,
		},
		{
			Name:          "High Memory Usage",
			Description:   "Alerts when a Pod consumes more than 1GB of RAM.",
			TriggerType:   "Metric",
			TriggerConfig: `sum(container_memory_working_set_bytes{container!=""}) by (namespace, pod) > 1000000000`,
			ActionType:    "Report",
			IsEnabled:     true,
		},
	}

	for _, r := range recipes {
		db.Create(&r)
	}
	log.Println("Seeded default automation recipes")
}

func seedDefaultProject(db *gorm.DB) {
	// Create Default Project if not exists
	var count int64
	db.Model(&Project{}).Count(&count)
	if count == 0 {
		defaultProject := Project{Name: "Default"}
		if err := db.Create(&defaultProject).Error; err != nil {
			log.Printf("Error seeding default project: %v", err)
			return
		}
		log.Println("Seeded 'Default' project")

		// Assign all existing users to Default Project
		db.Model(&User{}).Where("project_id IS NULL").Update("project_id", defaultProject.ID)
	}
}
