# Troubleshooting

## Docker Status Commands

```bash
# All BillForge containers
docker ps -a --filter "label=com.docker.compose.project=billforge" --format 'table {{.Names}}\t{{.Status}}'

# Volumes
docker volume ls --format '{{.Name}}' | grep billforge

# Networks
docker network ls --format '{{.Name}}' | grep billforge
```

## Health Checks

```bash
# Backend
curl http://localhost:4100/health

# OCR service
curl http://localhost:8200/v1/health

# SLM service
curl http://localhost:8300/v1/health

# MinIO
curl http://localhost:9100/minio/health/live
```

## Common Issues

### MinIO bucket missing

**Symptom**: S3 uploads fail with `NoSuchBucket` error.

**Cause**: The `minio-init` service didn't run or failed silently.

**Fix**:
```bash
docker compose up -d minio-init
docker logs billforge-minio-init
```

### Login returns 403

**Symptom**: `/auth/callback` returns 403 after local-sts login.

**Cause**: `AUTH_AUTO_PROVISION_USERS` is not set to `true`. The local-sts user (`admin@local.test`) doesn't exist in MongoDB and auto-provisioning is disabled.

**Fix**: Ensure `AUTH_AUTO_PROVISION_USERS=true` in docker-compose.yml environment (this is the default). If you've overridden it in `backend/.env`, remove that override.

### OCR / SLM services not ready

**Symptom**: Backend hangs on startup or returns 503.

**Cause**: Backend blocks readiness until OCR and SLM services are healthy and reachable.

**Fix**:
```bash
# Check if ML services are running on host
curl http://localhost:8200/v1/health
curl http://localhost:8300/v1/health

# Check logs
cat .local-run/ocr.log
cat .local-run/slm.log

# Restart ML services
yarn ocr:start
yarn slm:start
```

### Orphaned volumes from old project name

**Symptom**: Old `invoiceprocessor_*` volumes taking up disk space.

**Cause**: The compose project was renamed from `invoiceprocessor` to `billforge`. Old volumes were not automatically cleaned up.

**Fix**:
```bash
# List old volumes
docker volume ls --format '{{.Name}}' | grep invoiceprocessor

# Remove them (data will be lost)
docker volume rm invoiceprocessor_mongo_data invoiceprocessor_minio_data
```

### Port conflicts

**Symptom**: Container fails to start with "address already in use".

**Fix**: Check what's using the port and stop it:
```bash
lsof -i :4100   # Backend
lsof -i :5174   # Frontend
lsof -i :27018  # MongoDB
lsof -i :8200   # OCR (host service)
lsof -i :8300   # SLM (host service)
```

## Log Access

```bash
# Backend logs
docker logs billforge-backend --tail 50

# MinIO init logs
docker logs billforge-minio-init

# Local-STS logs
docker logs billforge-local-sts --tail 20

# MailHog OAuth wrapper
docker logs billforge-mailhog-oauth --tail 20

# Follow logs in real-time
docker logs -f billforge-backend
```
