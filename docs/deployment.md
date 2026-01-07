# Production Deployment Guide 🚀

This guide details how to deploy KubeTriage to **any** Kubernetes cluster, including:
- **Cloud Managed**: EKS (AWS), GKE (Google), AKS (Azure), DOKS (DigitalOcean).
- **On-Premise / Self-Managed**: Kubeadm, RKE2, K3s, OpenShift, VMWare Tanzu.

## Prerequisites
- Kubernetes Cluster 1.25+ (Any CNCF certified distribution)
- Helm 3.x installed
- kubectl configured
- Google Cloud API Key (for Gemini AI)
- OIDC Provider (Google, Keycloak, Okta, Dex, or similar)

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
Create a `prod-values.yaml` file. This configuration works for both Cloud LoadBalancers and On-Prem Ingress Controllers (like Nginx/Traefik/HAProxy).

```yaml
backend:
  env:
    # URL where users will access the dashboard
    FRONTEND_URL: "https://triage.corp.example.com"
    # Enable real OIDC (requires an Identity Provider)
    MOCK_OIDC: "false"

ingress:
  enabled: true
  # Change this to match your cluster's Ingress Class (e.g., 'nginx', 'traefik', 'alb')
  className: "nginx"
  hosts:
    - host: triage.corp.example.com
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
