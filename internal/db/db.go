package db

import (
	"log"
	"time"

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

	// Retry logic for DB connection (wait for container)
	for i := 0; i < 10; i++ {
		DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			log.Println("Connected to Database")
			break
		}
		log.Printf("Failed to connect to DB, retrying in 2s... (%d/10)", i+1)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		return nil, err
	}

	// Auto-Migrate Schemas
	err = DB.AutoMigrate(&User{}, &Session{}, &Playbook{}, &TriageReport{}, &AuditLog{}, &Project{}, &ClusterProject{})
	if err != nil {
		log.Printf("Warning: AutoMigrate failed: %v", err)
	}

	// Seed Default Project
	go seedDefaultProject(DB)

	return DB, nil
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
