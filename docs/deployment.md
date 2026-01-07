# Production Deployment Guide 🚀

This guide details how to deploy KubeTriage to a production Kubernetes cluster (EKS, GKE, or AKS) using Helm.

## Prerequisites
- Kubernetes Cluster 1.25+
- Helm 3.x installed
- kubectl configured
- Google Cloud API Key (for Gemini AI)
- Google OAuth Credentials (for OIDC Login)

## 1. Environment Setup

### Create Secrets
It is strictly recommended to manage secrets via a secure vault or `external-secrets`. For manual setup:

```bash
kubectl create secret generic kubetriage-secrets \
  --from-literal=GEMINI_API_KEY="your-gemini-key" \
  --from-literal=GOOGLE_CLIENT_ID="your-client-id" \
  --from-literal=GOOGLE_CLIENT_SECRET="your-client-secret" \
  --from-literal=SESSION_SECRET="random-32-byte-string"
```

## 2. Helm Deployment

### Add Repositories
(Skipped if using local charts)
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm dependency update charts/kubetriage
```

### Configure `values.yaml`
Create a `prod-values.yaml` file:

```yaml
backend:
  env:
    # Ensure this matches your Ingress/LoadBalancer
    FRONTEND_URL: "https://triage.your-company.com"
    # Using real OIDC
    MOCK_OIDC: "false"

ingress:
  enabled: true
  className: "nginx"
  hosts:
    - host: triage.your-company.com
      paths:
        - path: /
          pathType: ImplementationSpecific
```

### Install Chart
```bash
helm upgrade --install kubetriage ./charts/kubetriage \
  --values prod-values.yaml \
  --set backend.env.GEMINI_API_KEY=$GEMINI_API_KEY_REF
```

## 3. Post-Deployment Verification
Visit `https://triage.your-company.com` and sign in with Google.
Check the `/health` endpoint to ensure DB and Redis connectivity.

```bash
kubectl get pods
# Expect: backend, frontend, postgres, redis-master
```

## Troubleshooting
- **Redis Connection**: If backend logs `Redis Connection Refused`, ensure the `REDIS_ADDR` env var matches the generated service name (default: `kubetriage-redis-master:6379`).
- **OIDC Loops**: Check `FRONTEND_URL` and Google Console "Authorized Redirect URIs".
