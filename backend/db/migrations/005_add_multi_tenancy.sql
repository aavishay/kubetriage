-- Create Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Link Users to Projects
ALTER TABLE users ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- Link TriageReports to Projects
ALTER TABLE triage_reports ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);

-- Create ClusterProject mapping table
CREATE TABLE IF NOT EXISTS cluster_projects (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     cluster_id TEXT NOT NULL, -- Corresponds to kubeconfig context name
     project_id UUID NOT NULL REFERENCES projects(id),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     UNIQUE(cluster_id) -- A cluster belongs to only one project (for now)
);

-- Seed a default project "Default" if none exists
INSERT INTO projects (name)
SELECT 'Default'
WHERE NOT EXISTS (SELECT 1 FROM projects);

-- Assign existing users to the Default project
UPDATE users SET project_id = (SELECT id FROM projects WHERE name = 'Default') WHERE project_id IS NULL;
