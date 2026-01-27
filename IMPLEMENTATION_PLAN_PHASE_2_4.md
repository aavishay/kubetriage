# Implementation Plan: Automation & Security Guardrails (Human-in-the-Loop)

## Goal
Implement Phase 2 (Recipe/Automation Engine) and Phase 4 (Security Triage) by creating a proactive background service that detects issues and security risks, generating actionable `TriageReports` for human approval.

## core Principles
- **Human-in-the-Loop**: No action is taken automatically. All detections result in a `TriageReport`.
- **Proactive**: The system scans in the background, not just when a user logs in.
- **Unified Interface**: Use the existing `TriageReport` and `Approval` mechanism.

## Tasks

### 1. Automation Engine (`internal/automation/`)
- [ ] Create `Recipe` definition (Trigger -> Analysis -> Remediation).
- [ ] Implement `AutomationService` to run periodic checks.
- [ ] **Recipe 1: Rapid CrashLoop Detection**
    - Trigger: Pod restarts > 5 in 10 minutes.
    - Action: Generate Triage Report with "High" severity.
    - Remediation: (AI or Rule-based) Suggest `previous` logs inspection or Rollback.
- [ ] **Recipe 2: Stalled Release**
    - Trigger: Deployment has unavailable replicas > 5 mins.
    - Action: Generate Triage Report.

### 2. Security Triage (`internal/security/`)
- [ ] Implement `SecurityScanner` struct.
- [ ] **Check 1: Privileged Containers**
    - Trigger: `securityContext.privileged == true`.
    - Action: Generate Triage Report (Severity: High).
    - Remediation: JSON Patch to set `privileged: false` (Human must confirm this won't break app).
- [ ] **Check 2: Root User**
    - Trigger: `runAsNonRoot != true` or `runAsUser == 0`.
    - Action: Generate Triage Report (Severity: Medium).

### 3. Backend Integration
- [ ] Initialize `AutomationService` and `SecurityScanner` in `server.ts` (or Go equivalent `cmd/server/main.go`).
- [ ] Ensure they run in background goroutines or Cron.

### 4. Verification
- [ ] Simulate a simplified "Privileged Pod".
- [ ] Verify a `TriageReport` appears in the UI (waiting for approval).
- [ ] Verify "Approve" executes the patch (fixes the Security Context).
