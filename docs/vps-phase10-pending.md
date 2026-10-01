# Phase 10 VPS pending checklist

All items in this document are **PENDING**. They require the future
production VPS and cannot be completed from the repository alone.

## VPS and host prerequisites

- **PENDING** Provision the production VPS with sufficient CPU, memory, disk,
  backup workspace, and network access.
- **PENDING** Install Docker Engine, Docker Compose v2, Bash, Git, Restic,
  OpenSSL, PostgreSQL client tools, `tar`, `find`, and standard shell tools.
- **PENDING** Confirm firewall rules, SSH hardening, time synchronization, disk
  monitoring, and restricted administrative access.
- **PENDING** Confirm the required container images can be pulled or are
  available locally, including `alpine:3.20` and `postgres:16-alpine`.

## Docker and Compose deployment

- **PENDING** Clone the approved repository release to the production path.
- **PENDING** Create and validate the production Compose environment file.
- **PENDING** Confirm `docker-compose.prod.yml` parses in Meta-only mode and
  Evolution mode as applicable.
- **PENDING** Confirm `WHATSAPP_PROVIDER=evolution` for the current deployment.
- **PENDING** Confirm the Compose project name and actual persistent volume
  names match the backup configuration.
- **PENDING** Confirm PostgreSQL, n8n, backend, frontend, Caddy, Evolution,
  Redis, and `evolution-db-init` are healthy/completed as appropriate.
- **PENDING** Confirm the one-shot `backend-migrate` service completes
  successfully before the backend is exposed.

## Production secrets and host-only files

- **PENDING** Create root-owned, mode `0600` secret files outside Git:
  `/etc/whatsapp-ip-agent/production.env`,
  `/etc/whatsapp-ip-agent/backup.env`, and
  `/etc/whatsapp-ip-agent/restic-password`.
- **PENDING** Populate `production.env` with approved application, database,
  n8n, Meta/Evolution, webhook, JWT, admin, and AI configuration.
- **PENDING** Preserve the exact `N8N_ENCRYPTION_KEY` in the recovery escrow.
- **PENDING** Confirm no production secret is stored in GitHub, Docker images,
  backup scripts, or public logs.
- **PENDING** Store a separate recovery copy of all required production
  secrets and document authorized access.

## Restic and Cloudflare R2

- **PENDING** Create a private Cloudflare R2 bucket for the Restic repository.
- **PENDING** Create a restricted R2 token limited to the backup bucket.
- **PENDING** Configure host-only R2 variables:
  `RESTIC_REPOSITORY`, `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, and
  `AWS_ENDPOINT_URL`.
- **PENDING** Place the Restic repository password only in the protected
  `restic-password` file and recovery escrow.
- **PENDING** Initialize the Restic repository from the production VPS.
- **PENDING** Run a non-destructive Restic repository read/list check.
- **PENDING** Confirm encryption, bucket access restrictions, and retention
  policy.

## First real backup

- **PENDING** Schedule an approved maintenance window for the initial backup.
- **PENDING** Run `ops/backup/backup.sh` against the live Evolution
  deployment.
- **PENDING** Confirm application, n8n, Evolution, and PostgreSQL globals
  artifacts are present in the encrypted snapshot.
- **PENDING** Confirm n8n, Caddy, Evolution, and Redis restart successfully
  after quiescing.
- **PENDING** Confirm the backup exits successfully and the tagged snapshot is
  visible in R2.
- **PENDING** Record backup duration, snapshot ID, size, and completion time
  without recording secrets or sensitive payloads.

## Restore drill and verification

- **PENDING** Provision an isolated disposable restore environment with no
  public traffic and no live WhatsApp connectivity.
- **PENDING** Run `ops/backup/verify-restore.sh` against the selected snapshot.
- **PENDING** Restore PostgreSQL globals, application data, n8n data, Evolution
  data, and persistent volumes in the documented order.
- **PENDING** Verify conversations, leads, processed-message records, n8n
  workflow loading, and credential decryption with the preserved encryption key.
- **PENDING** Verify Evolution database/Redis state without sending messages or
  reconnecting a live WhatsApp instance.
- **PENDING** Verify Caddy configuration/certificate state and backend/admin
  health while public traffic remains closed.
- **PENDING** Record failures, restore duration, and corrective actions.

## Scheduling and alerting

- **PENDING** Create root-owned systemd service/timer or equivalent host
  scheduler for the approved backup interval.
- **PENDING** Configure failure detection for nonzero backup exits.
- **PENDING** Configure stale-success detection for backups older than the
  approved schedule plus grace period.
- **PENDING** Configure alerts that exclude environment contents, database URLs,
  R2 credentials, Restic passwords, and PII.
- **PENDING** Monitor VPS disk space, Docker health, PostgreSQL availability,
  R2 access, and backup repository health.

## VPS migration and recovery

- **PENDING** Document the VPS A to VPS B recovery owner, access path, and
  secret escrow procedure.
- **PENDING** Test recovery of source code from GitHub and secrets from the
  separate escrow.
- **PENDING** Test recovery of the Restic repository from R2 on a new VPS.
- **PENDING** Restore the application in the documented dependency order:
  PostgreSQL, databases/globals, n8n, Evolution/Redis, backend/frontend, and
  Caddy.
- **PENDING** Keep public traffic and live WhatsApp delivery disabled until
  recovery verification passes.
- **PENDING** Test R2 credential rotation by replacing the host-only token,
  verifying a repository read/test backup, then revoking the old token.

## RPO, RTO, and final production verification

- **PENDING** Approve the operational backup interval and target RPO.
- **PENDING** Measure backup completion time and confirm the target RPO in
  practice.
- **PENDING** Measure full restore time and confirm or revise the target RTO.
- **PENDING** Repeat restore verification after any material deployment,
  database, or provider change.
- **PENDING** Confirm retention pruning affects only the
  `whatsapp-ip-agent` Restic tag.
- **PENDING** Complete final production verification of Docker health,
  PostgreSQL, n8n, Evolution, Redis, backend, frontend, Caddy, webhooks, admin
  access, and backup freshness.
- **PENDING** Record the final handover runbook, ownership, escalation path,
  last successful backup, last restore drill, measured RPO/RTO, and known
  limitations.
