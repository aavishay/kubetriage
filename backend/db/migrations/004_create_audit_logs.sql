-- Migration: 004_create_audit_logs
-- Description: Creates table for audit trails

CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID,
    user_email VARCHAR(255),
    action VARCHAR(50), -- e.g. "PATCH_WORKLOAD", "LOGIN"
    resource VARCHAR(255), -- e.g. "deployment/frontend"
    details TEXT, -- JSON blob of changes or payload
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
