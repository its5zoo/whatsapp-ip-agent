# Backup and VPS recovery

This document describes the repository-side backup foundation for the
single-VPS deployment. Restic encrypts backups before storing them in a
private Cloudflare R2 bucket. Real credentials remain on the VPS and in the
operator's separate recovery escrow; they must never be committed to GitHub or
stored in the Restic repository.

## Scope

The backup job covers:

- The application PostgreSQL database (`whatsapp_agent` by default).
- The n8n PostgreSQL database (`n8n`).
- The Evolution PostgreSQL database and Redis volume when
  `WHATSAPP_PROVIDER=evolution` is set in `production.env`.
- The `n8n_data`, Caddy data, and Caddy config Docker volumes.
- A non-secret manifest containing the UTC timestamp and Git revision.

The Caddyfile and Compose files are recovered from GitHub. Runtime environment
files, Restic credentials, R2 credentials, SSH keys, and the n8n encryption key
are not backed up by Restic and must be recovered separately.

## VPS secret layout

Create these files outside the repository, owned by root with mode `0600`:

```text
/etc/whatsapp-ip-agent/production.env
/etc/whatsapp-ip-agent/backup.env
/etc/whatsapp-ip-agent/restic-password
```

`production.env` is consumed by Docker Compose. It contains the application,
database, n8n, Meta/Evolution, and other deployment values.

`backup.env` is based on `ops/backup/backup.env.example` and contains the
Restic/R2 settings and host/Compose paths. It must not be passed to application
containers.

`restic-password` contains the Restic repository password. Keep a separate
copy in the recovery escrow. Do not put it in `backup.sh`.

The original `N8N_ENCRYPTION_KEY` must be preserved in the recovery escrow and
in `production.env`. Restored n8n credentials depend on that exact value.

## R2 and Restic setup

Create a private R2 bucket and a token restricted to that bucket. Put the
endpoint, repository, access key, secret key, and Restic password file path in
the host-only `backup.env`. Initialize the repository once on the VPS using
the operator's approved Restic command. Do not paste credentials into shell
history or commit them.

The repository scripts use the standard Restic S3 environment variables:

```text
RESTIC_REPOSITORY
RESTIC_PASSWORD_FILE
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_DEFAULT_REGION
AWS_ENDPOINT_URL
```

## Backup operation

Before the first run:

1. Ensure the production stack is running and the PostgreSQL container is
   healthy.
2. Confirm `backup.env` points to the correct Compose project and environment.
3. Set `WHATSAPP_PROVIDER` to the active provider in `production.env`. If it is
   absent, the script accepts only the repository's explicit Compose default of
   `meta`; otherwise it fails closed.
4. Confirm the Restic repository has been initialized and is reachable.

Run:

```bash
sudo /opt/whatsapp-ip-agent/ops/backup/backup.sh
```

The script creates custom-format PostgreSQL dumps and a globals/roles dump
through the running PostgreSQL container. It then stops n8n and Caddy, and also
Evolution and Redis when `WHATSAPP_PROVIDER=evolution`, before archiving their
volumes. The services are restarted immediately after archiving, including
when archiving fails.
Restic uploads an encrypted snapshot, verifies the tagged repository, then
prunes only `whatsapp-ip-agent` snapshots.

The script fails if a dump, archive, upload, prune, or integrity check fails.
It does not use shell tracing and removes its temporary plaintext files on exit.
Do not redirect its environment or Docker inspection output into tickets or
logs.

## Retention and target objectives

The initial policy is:

- Run every six hours.
- Keep 14 daily snapshots.
- Keep 8 weekly snapshots.
- Keep 6 monthly snapshots.
- Target RPO: six hours.
- Initial target RTO: four hours, subject to a measured restore drill.

Scheduling and alerting are host responsibilities and are intentionally not
implemented as systemd units in this repository foundation.

## Restore procedure

The restore script is deliberately conservative: it restores a Restic
snapshot into a target directory and does not overwrite live Docker volumes.
The target directory must not already exist. Restore PostgreSQL into a
stopped-target stack with only PostgreSQL running. The single invocation below
creates the isolated directory, validates the manifest and required dumps, and
then performs the explicitly confirmed database restore:

```bash
sudo env \
  RESTORE_SNAPSHOT=<snapshot-id> \
  RESTORE_TARGET_DIR=/var/tmp/whatsapp-ip-restore \
  CONFIRM_RESTORE=yes \
  RESTORE_DATABASES=yes \
  CONFIRM_DATABASE_RESTORE=yes \
  /opt/whatsapp-ip-agent/ops/backup/restore.sh
```

This restores `globals.sql` first, then the application and n8n databases, and
Evolution when the snapshot manifest records `WHATSAPP_PROVIDER=evolution`.
Use this only against a fresh/disposable target or after deliberately stopping
dependent services; the command mutates PostgreSQL.

For a full VPS recovery:

1. Install Docker, Compose, Restic, PostgreSQL client tools, and the
   `alpine:3.20` and `postgres:16-alpine` images on VPS B.
2. Clone the intended release from GitHub.
3. Recover `production.env`, `backup.env`, `restic-password`, and the exact
   `N8N_ENCRYPTION_KEY` from the separate secret escrow.
4. Stop public traffic and start only PostgreSQL.
5. Recreate the application, n8n, and Evolution databases as applicable.
6. Restore `globals.sql` and PostgreSQL roles first, then application, n8n, and
   Evolution dumps. The disposable verifier exercises the application and n8n
   database restores.
7. Restore `n8n_data`, Evolution Redis state, `caddy_data`, and `caddy_config`
   into their Docker volumes.
8. Start Redis/Evolution when enabled, then n8n, backend, frontend, and Caddy.
9. Keep public traffic closed until verification passes.

Do not regenerate `N8N_ENCRYPTION_KEY` during recovery. Do not reconnect or
mutate a live Evolution WhatsApp instance as part of restore verification.

## Verification

The repository-side verification script restores the snapshot into a disposable
PostgreSQL container, restores the application/n8n/Evolution databases as
applicable, runs representative application queries, and validates persistent
volume archive extraction:

```bash
sudo env VERIFY_SNAPSHOT=<snapshot-id> \
  /opt/whatsapp-ip-agent/ops/backup/verify-restore.sh
```

This is not a full service-level restore drill. A complete quarterly drill must
restore into disposable PostgreSQL/Docker volumes and verify:

- Application conversations, leads, and processed-message records.
- n8n workflow loading and credential decryption with the original key.
- Evolution database and Redis state when enabled.
- Backend health and admin login.
- Caddy certificate/state loading.
- No public traffic or real WhatsApp message delivery from the test stack.

Record the restore duration and update the RTO if it exceeds four hours.

## Failure detection and rotation

The backup command must return nonzero on any failure. The eventual host
timer/monitor should alert on a failed run or when the last-success timestamp
is older than the six-hour schedule plus a grace period. Alert messages must
not include environment contents, database URLs, backup passwords, or R2
credentials.

To rotate a compromised R2 credential:

1. Create a replacement R2 token limited to the backup bucket.
2. Update only the root-owned host `backup.env`.
3. Run a repository read and a test backup.
4. Revoke the old R2 token.
5. Confirm the next scheduled backup and update the recovery escrow.

No application code or Docker image change is required. Restic repository
password rotation is a separate, deliberate operation.
