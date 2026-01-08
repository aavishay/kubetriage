-- Migration: 002_add_auth_fields
-- Description: Adds provider info and avatar URL to users table for OIDC support

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'local',
ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create index for faster lookups by provider ID
CREATE INDEX IF NOT EXISTS idx_users_provider_id ON users(provider, provider_id);
