-- Migration: 003_add_role_field
-- Description: Adds role column to users table for RBAC

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'viewer';

-- Ensure existing users have a role (optional, handled by default above)
UPDATE users SET role = 'viewer' WHERE role IS NULL;
