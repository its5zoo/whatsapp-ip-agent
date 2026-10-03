# WhatsApp IP Agent — Project Handoff

**Document purpose:** Living, durable context for any agent taking over this repository.
**Last updated:** 2026-10-02 20:18 (+05:30)
**Repository:** `0xyusufz/whatsapp-ip-agent`
**Current branch:** `main`
**Current HEAD:** `cc63ea8dfb498227024d18b126efe22d69c48bbb`
**Remote state:** `origin/main` points to the same commit.

> This document describes the current repository and working-tree state. It is not permission to commit, push, deploy, modify production, or alter the database.

## Living-document rule

`PROJECT_HANDOFF.md` is the canonical project handoff and change record for this repository.

From this point forward, every project change must be reflected in this file during the same task or handoff update, including:

- production-code changes;
- test changes;
- configuration and infrastructure changes;
- migration changes;
- deployment or operational changes;
- validation results;
- discovered bugs, blockers, risks, and decisions;
- commit and push state.

Each update must keep the following sections accurate:

1. Current position
2. Exact Git state
3. Active implementation
4. Known validation results
5. Current blockers
6. Immediate next work
7. Change log

If a future agent changes a file, it must update this document before finishing. If a fact is not verified, it must be marked **UNKNOWN** rather than inferred.

## 1. Current position

The project is a deterministic WhatsApp IP enquiry agent for GenioBrain IP Solution. The questionnaire engine, PostgreSQL persistence, Meta integration, Evolution integration, admin dashboard, n8n notification path, Docker/Caddy deployment, outbound outbox, retry logic, and production-hardening foundations are already implemented.

The completed-conversation contract, Evolution webhook test synchronization work, WhatsApp sender-mobile change, frontend CRM UX pass, local HTTPS/API development setup, Phase 2 persisted Lead status capability, and Phase 3 persistent CRM Follow-ups are implemented and locally verified. All changes remain intentionally uncommitted pending final authorization. No commit or push has been made.

The current uncommitted CRM correction also supports multiple independent enquiry
records per Conversation. The one-to-many relation is represented by the
`20261003090000_remove_lead_conversation_unique` migration, which removes the
old unique constraint and adds a non-unique `conversation_id` index without
rewriting existing Lead rows.

The most important current product rule is:

> A completed enquiry is closed. Normal messages must not edit, delete, overwrite, restart, or create anything for that completed enquiry. Only explicit `BACK`, followed by option `1`, may begin a new enquiry.

## 2. Exact Git state

Current status:

```text
 M backend/src/engine/answerDecoder.ts
 M backend/src/engine/questions.ts
 M backend/src/prisma/schema.prisma
 M backend/src/routes/admin.ts
 M backend/src/services/adminFollowUpService.ts
 M backend/src/services/adminLeadService.ts
 M backend/src/services/conversationService.ts
 M backend/test/admin.test.ts
 M backend/test/answerDecoder.test.ts
 M backend/test/db.test.ts
 M backend/test/n8n.test.ts
 M backend/test/simulator.test.ts
 M frontend/.gitignore
 M frontend/package.json
 M frontend/src/app/dashboard/conversations/[id]/page.tsx
 M frontend/src/app/dashboard/conversations/page.tsx
 M frontend/src/app/dashboard/layout.tsx
 M frontend/src/app/dashboard/leads/[id]/page.tsx
 M frontend/src/app/dashboard/follow-ups/page.tsx
 M frontend/src/app/dashboard/page.tsx
 M frontend/src/app/globals.css
 M frontend/src/app/login/page.tsx
 M frontend/src/lib/api.ts
 M frontend/src/lib/formatters.ts
 M frontend/src/types/index.ts
?? backend/src/prisma/migrations/20261002202000_add_lead_status/
?? backend/src/prisma/migrations/20261002203600_add_follow_ups/
?? frontend/src/app/api/
?? frontend/src/app/dashboard/follow-ups/
?? frontend/src/app/dashboard/leads/page.tsx
?? frontend/src/app/dashboard/settings/
```

There are:

- no staged changes;
- one untracked migration directory and four untracked frontend route directories/filesets;
- no local commits ahead of `origin/main`;
- `PROJECT_HANDOFF.md` is tracked and modified.

Current diff includes the existing backend changes, the frontend CRM changes, and this modified handoff document; use `git diff --stat` during final review for exact insertion/deletion counts.

The current uncommitted files are:

| File | Role | Scope |
|---|---|---|
| `backend/src/engine/answerDecoder.ts` | Dashboard answer decoding | Preserve the persisted mobile label |
| `backend/src/engine/questions.ts` | Questionnaire graph | Skip the user-facing mobile question |
| `backend/src/services/conversationService.ts` | Production conversation orchestration | Completed behavior and WhatsApp sender mobile population |
| `backend/src/prisma/schema.prisma` | Prisma data model | Persisted `LeadStatus` enum with `NEW` default |
| `backend/src/prisma/migrations/20261002202000_add_lead_status/migration.sql` | New migration | Adds the Lead status enum and non-null `NEW` column |
| `backend/src/prisma/migrations/20261002203600_add_follow_ups/migration.sql` | New migration | Adds persistent FollowUps and status enum |
| `backend/src/routes/admin.ts` | Protected admin API | Validated `PATCH /admin/leads/:id/status` |
| `backend/src/services/adminFollowUpService.ts` | Admin Follow-up data access | Protected Follow-up listing, creation, rescheduling, completion, and cancellation |
| `backend/src/services/adminLeadService.ts` | Admin Lead data access | Reads and updates persisted Lead status |
| `backend/test/admin.test.ts` | Admin API regression tests | Status authentication, transitions, validation, and not-found coverage |
| `backend/test/answerDecoder.test.ts` | Decoder regression test | Updated shared-field labels |
| `backend/test/continuity.test.ts` | Focused continuity tests | Completed-state contract |
| `backend/test/db.test.ts` | Database integration test | Persistence contract and WhatsApp sender mobile coverage |
| `backend/test/evolution.test.ts` | Evolution webhook tests | Event-specific async synchronization |
| `backend/test/n8n.test.ts` | n8n integration test | Updated questionnaire completion sequence |
| `backend/test/simulator.test.ts` | Simulator integration test | Updated questionnaire completion sequence |
| `frontend/src/app/dashboard/follow-ups/page.tsx` | CRM Follow-ups workspace | Real loading/error/empty states and Follow-up actions |
| `frontend/src/app/dashboard/leads/[id]/page.tsx` | Lead detail workspace | Compact persisted Follow-up section |
| `frontend/src/types/index.ts` | Frontend API types | FollowUp and status types |

Do not discard these changes without reviewing them. Do not modify unrelated user work.

The current final audit also includes:

- `backend/src/prisma/migrations/20261003090000_remove_lead_conversation_unique/migration.sql`
  as an untracked migration directory containing only the unique-index removal
  and replacement non-unique index creation;
- no staged changes, commits, pushes, or deployments;
- pre-existing untracked scratch files `tsx` and
  `whatsapp-ip-agent-backend@1.0.0`, which remain untouched.

The local development database has received all seven migrations through
`20261003090000_remove_lead_conversation_unique`; the local test database was
reset by the test harness and currently contains zero CRM rows. No production
or AWS database was touched.

## 3. Recent committed history

The relevant chronological history is:

```text
64b6b1d chore: add gitignore
b5e5372 Add local PostgreSQL and n8n stack
3786503 Add Fastify TypeScript backend foundation
a20693f Implement questionnaire conversation engine
e97cc85 Add PostgreSQL persistence with Prisma
72ef595 Add local WhatsApp simulator endpoint
2bbc292 Add AI fallback for natural-language questionnaire input
562c68f Complete Phase 5 AI fallback tests
eab9c75 Add configurable Gemini and Groq AI fallback providers
b48eb09 Add n8n lead notification integration
b0a6c71 Add admin dashboard and lead management
0404594 Add production Docker deployment
bd91b27 Isolate production databases and Compose project
9b40d55 Fix isolated test database configuration
889f327 Add Meta WhatsApp Cloud API integration
44cbff0 Add conversation continuity
bf7c77c Fix Evolution WhatsApp outbound messaging
3a4f941 Add incomplete conversation visibility to admin dashboard
266dcb5 Add incomplete conversation admin views
c7a9ff0 Add Evolution WhatsApp provider support
828a7c2 Add conversation continuity documentation
8250547 Harden production security and add backup recovery foundation
04b598c Harden WhatsApp processing and add outbound delivery
cc63ea8 Require confirmation before restarting completed enquiries
```

## 4. Active implementation: completed conversations

### Product contract

Once the questionnaire reaches completion and a Lead exists:

- the enquiry is closed;
- the completed Lead is not edited, deleted, overwritten, or modified through normal WhatsApp messages;
- arbitrary text does not restart the questionnaire;
- arbitrary text does not create a new Lead;
- arbitrary text does not invoke AI;
- no new Lead is created until a newly started enquiry is actually completed;
- HELP, SERVICES, CONSULTATION, and BACK keep their controlled behavior;
- incomplete conversations remain unchanged.

### Completed + HELP

Uses existing HELP behavior:

```text
HELP – Speak to our team 9284333589 (Mon to Fri 9.30 to 6.30)
```

### Completed + SERVICES

Uses existing SERVICES behavior:

```text
SERVICES – Explore our IP services
www.geniobrain.com
```

### Completed + CONSULTATION

Uses existing CONSULTATION behavior:

```text
CONSULTATION – Request a consultation
```

### Completed + BACK

`BACK` does not create a Lead and does not modify the existing Lead. It stores:

```text
_conversationMeta.continuityPrompt = "completed"
```

and returns exactly:

```text
You have already submitted an enquiry with GenioBrain IP Solution.

Would you like to create a new enquiry?

1. Yes – Start a new enquiry
2. No – Keep my existing enquiry
```

### Pending prompt + `1`

The service:

- clears the continuity metadata;
- resets `currentQuestionId` to `main_menu`;
- sets `isCompleted = false`;
- clears the questionnaire data for the new enquiry;
- preserves the existing completed Lead;
- does not create a new Lead yet;
- returns the existing main-menu question.

### Pending prompt + `2`

The service:

- clears the continuity metadata;
- preserves `isCompleted = true`;
- preserves the existing Lead;
- returns a short fixed acknowledgement;
- does not display another prompt automatically.

### Completed + arbitrary text

The fixed response is:

```text
Your previous enquiry has already been submitted. Please reply HELP to speak to our team, or BACK to start a new enquiry.
```

This path:

- does not enter the questionnaire engine;
- does not call AI;
- does not alter conversation answers;
- does not alter the completed Lead;
- does not create a new Lead.

There is intentionally no growing list for `OK`, `Okay`, `Thanks`, or similar phrases. There is also no completed-state AI intent classifier.

### Completed + edit/update/delete request

The request is not executed. The same controlled closed-state response is returned. No database mutation is performed. The user is directed to HELP or BACK.

## 5. Conversation state machine

```text
New user
  -> main_menu
  -> Patent / Trademark / Design / Copyright / Not Sure
  -> flow-specific questions
  -> shared contact questions
  -> completed
  -> Lead upsert + n8n notification

Incomplete + normal message
  -> continue current question

Incomplete + BACK
  -> main_menu
  -> conversation remains incomplete

Incomplete + long inactivity
  -> existing continuity prompt
  -> resume or restart according to existing contract

Completed + HELP/SERVICES/CONSULTATION
  -> existing controlled command response

Completed + BACK
  -> completed new-enquiry prompt

Completed prompt + 1
  -> main_menu
  -> incomplete
  -> existing Lead preserved

Completed prompt + 2
  -> completed/closed
  -> existing Lead preserved

Completed + arbitrary text
  -> fixed closed-state response
  -> no state/Lead/AI mutation
```

## 6. Questionnaire implementation

Authoritative requirements and wording are in:

```text
Whats app automation.pdf
```

Code representation:

```text
backend/src/engine/engine.ts
backend/src/engine/questions.ts
```

Do not redesign or casually modify the engine.

### Main menu

```text
1. Patent
2. Trademark
3. Design Registration
4. Copyright
5. Not sure
```

### Patent flow

```text
patent_type
patent_stage
patent_service
patent_desc
shared_name
shared_org
shared_email
shared_mobile
shared_city
shared_comm
shared_phone_time
```

The patent description retains the confidentiality warning.

### Trademark flow

```text
trademark_what
trademark_desc
trademark_usage
trademark_service
trademark_class
shared_name
shared_org
shared_email
shared_mobile
shared_city
shared_comm
shared_phone_time
```

### Design flow

```text
design_product
design_distinctive
design_disclosure
design_assistance
shared_name
shared_org
shared_email
shared_mobile
shared_city
shared_comm
shared_phone_time
```

### Copyright flow

```text
copyright_type
copyright_completion
copyright_assistance
shared_name
shared_org
shared_email
shared_mobile
shared_city
shared_comm
shared_phone_time
```

### Not Sure flow

```text
notsure_desc
shared_name
shared_org
shared_email
shared_mobile
shared_city
shared_comm
shared_phone_time
```

The Not Sure path collects a description and does not make an automated legal determination.

### Engine rules

- Commands are handled before ordinary question processing.
- Choice questions accept exact trimmed numeric option IDs.
- Required text questions reject empty input.
- `optional_text` allows empty input.
- Invalid choice input returns the invalid-option response and may use bounded AI fallback.
- AI may only map input to one of the explicit valid option IDs.
- AI does not control questionnaire state, completion, persistence, security, provider behavior, or completed-conversation intent.

## 7. Persistence and data model

Primary Prisma models:

- `Conversation`
- `Lead`
- `ProcessedWhatsappMessage`
- `WhatsappOutboundMessage`

Important behavior:

- A Conversation is unique by `(channel, externalUserId)`.
- A Lead is currently unique by `conversationId`.
- A completed flow upserts the Lead at completion.
- Missing completed Leads can be recovered from stored conversation data.
- WhatsApp inbound deduplication uses `ProcessedWhatsappMessage`.
- Inbound deduplication and outbound creation are transactional.
- PostgreSQL advisory transaction locks serialize messages for one channel/user.
- n8n notification happens asynchronously after the core transaction.

Important unresolved data-model consideration:

`Lead.conversationId` is unique. The current finalized behavior preserves the existing Lead while a new enquiry is incomplete. If a second enquiry is later completed on the same Conversation, the current upsert model will reuse that Lead row. Supporting multiple historical Leads per user would require an explicit product/schema decision and is out of scope for the current work.

### Migration history

Existing migrations:

```text
backend/src/prisma/migrations/20260928110740_init/migration.sql
backend/src/prisma/migrations/20260929070235_add_whatsapp_message_dedup/migration.sql
backend/src/prisma/migrations/20261002004500_add_whatsapp_outbound_messages/migration.sql
```

The first two migration SQL files were required to remain byte-for-byte unchanged during Phase 9 tracking work.

The outbound migration creates `whatsapp_outbound_messages`.

Production Compose has a one-shot `backend-migrate` service that runs:

```text
npx prisma migrate deploy --schema src/prisma/schema.prisma
```

Do not run any database-mutating Prisma command without explicit authorization. In particular, do not run:

```text
prisma db push
prisma migrate reset
--accept-data-loss
```

## 8. WhatsApp architecture

```text
Meta/Evolution webhook
  -> provider parser/authentication
  -> WhatsApp route
  -> ConversationService
  -> Questionnaire Engine
  -> Prisma/PostgreSQL
  -> WhatsApp outbound outbox
  -> WhatsappDeliveryService
  -> Meta or Evolution provider
  -> WhatsApp
```

### Meta

Files:

```text
backend/src/whatsapp/providers/meta.ts
backend/src/services/whatsappClient.ts
```

Behavior:

- verifies Meta challenge;
- verifies HMAC signature;
- parses inbound events;
- delegates outbound sending;
- classifies provider outcomes.

### Evolution

Files:

```text
backend/src/whatsapp/providers/evolution.ts
backend/src/routes/whatsapp.ts
```

Behavior:

- verifies the shared webhook secret;
- handles `MESSAGES_UPSERT`;
- ignores `fromMe`;
- requires sender/message IDs;
- normalizes text events;
- converts media into unsupported events;
- sends through `/message/sendText/{instance}`;
- strips JID suffixes and leading `+`;
- classifies 429 and 5xx as retryable;
- treats timeouts/network failures as retryable unknown outcomes.

Evolution Compose details:

- image: `evoapicloud/evolution-api:v2.3.7`;
- separate Evolution PostgreSQL database named `evolution`;
- Redis 7 Alpine;
- internal webhook URL: `http://backend:3000/webhook/evolution`;
- production API key/instance values are host-only configuration.

### Webhook route

`backend/src/routes/whatsapp.ts`:

- acknowledges valid webhook requests with HTTP 200 quickly;
- processes the event asynchronously;
- creates unsupported-media outbox records transactionally;
- deduplicates WhatsApp message IDs;
- invokes outbound delivery.

## 9. Outbound outbox

Files:

```text
backend/src/services/whatsappDeliveryService.ts
backend/src/db/repositories/whatsappOutboundMessageRepository.ts
backend/src/services/whatsappClient.ts
```

Statuses:

```text
pending
sending
sent
retryable
failed
```

Behavior:

- atomic claims with `FOR UPDATE SKIP LOCKED`;
- bounded concurrent dispatch, currently four;
- stale lease recovery;
- retry classification for 429, 5xx, timeouts, and network failures;
- shutdown waits for active sends, bounded by the configured shutdown window;
- provider response bodies are not logged as sensitive content.

The webhook tests must synchronize on durable event-specific state. They must not rely on global mock call counts or arbitrary sleeps.

## 10. AI fallback

File:

```text
backend/src/ai/aiFallbackService.ts
```

Configuration includes:

- `AI_PROVIDER`
- `AI_API_KEY`
- `AI_MODEL`
- `AI_CONFIDENCE_THRESHOLD`
- `AI_TIMEOUT_MS`

AI is only used when deterministic processing rejects input for a choice question. It receives the current question/options and bounded user input, then must return a valid explicit option ID with acceptable confidence.

Safety behavior rejects or blocks:

- credentials;
- tokens;
- payment information;
- prompt injection;
- code/config payloads;
- multiline suspicious input;
- unknown or hallucinated option IDs;
- invalid confidence structures.

AI currently runs inside the conversation transaction for invalid choices. This is a known reliability concern because provider latency can extend transaction duration. Do not change this as part of the current completed-conversation fix.

## 11. Admin and human handoff

Admin routes are in:

```text
backend/src/routes/admin.ts
backend/src/services/adminLeadService.ts
```

Available protected operations include:

- Lead listing/filtering;
- Lead detail;
- decoded questionnaire answers;
- incomplete conversation listing/detail;
- statistics.

HELP provides the human contact route. n8n receives `lead.created` notifications after successful persistence. There is no separate persisted human-handoff state.

## 12. Docker and Caddy

### Local Compose

`docker-compose.yml` provides:

- PostgreSQL 16 Alpine;
- n8n;
- PostgreSQL bound to `127.0.0.1:5433`;
- n8n on port `5678`;
- persistent local volumes.

### Production Compose

`docker-compose.prod.yml` provides:

- PostgreSQL;
- n8n;
- optional Evolution database initializer;
- optional Evolution Redis;
- optional Evolution API;
- Evolution credential check;
- backend migration service;
- backend;
- frontend;
- Caddy.

### Caddy

`caddy/Caddyfile` routes:

- `/api/*` to backend;
- `/health` to backend;
- `/webhook/*` to backend;
- all other paths to frontend.

The `/webhook/*` route must be retained. Do not redesign Caddy or Docker for the current task.

## 13. Test infrastructure

Files:

```text
backend/test/runAll.ts
backend/test/resetTestDatabase.ts
```

The custom runner:

- enumerates test files deterministically;
- resets the test database before each file;
- runs each file in a separate child process;
- executes sequentially.

Parallel database-backed test execution is unsafe because all processes use the same PostgreSQL test database.

`resetTestDatabase.ts` verifies the active database is exactly:

```text
whatsapp_agent_test
```

before deleting application data.

## 14. Known validation results

Latest known focused results:

| Validation | Result |
|---|---|
| Continuity suite | 13 passed |
| Simulator suite | 10 passed |
| DB suite | 13 passed |
| Backend build | Passed |
| Prisma validation | Passed |
| `git diff --check` | Passed |
| Focused answer-decoder, DB, n8n, and simulator tests after mobile change | Passed |
| Unsupported-media Evolution test in isolation | Passed |
| Meta-provider Evolution test in isolation | Passed |
| Full Evolution suite | 13/13 passed in 13 repeated sequential runs after event-specific synchronization |
| Latest full backend `npm test` after mobile change | Passed; all backend test files completed successfully |
| Evolution suite rerun independently after that failure | 13/13 passed |
| WhatsApp outbound delivery suite | 10/10 passed, including explicit retryable failure test |
| Backend build after delivery investigation | Passed |

The latest full `npm test` result after all current changes passed.

## 15. Current test blocker

There is no active test blocker. The final full backend `npm test` passed all test files, the focused admin suite passed, the independent Evolution suite passed 13/13, the backend build passed, Prisma validation passed, and the frontend lint/build passed. The frontend lint warning in `frontend/src/lib/api.ts` remains pre-existing and non-failing.

Phase 2 local Docker verification passed:

- 12 existing Docker Leads were preserved and had status `NEW` after migration;
- authenticated Lead list/detail requests returned `200`;
- an existing Lead changed `NEW → CONTACTED`, persisted after reload, then changed `CONTACTED → QUALIFIED` and persisted after reload;
- customer data and questionnaire answers remained unchanged;
- the linked conversation remained completed with `current_question_id` null;
- the incomplete-conversation endpoint continued returning `200` with 16 existing incomplete conversations.

The local test database was reset only through the existing test reset utility before running isolated/full tests. No application production data was deleted.

Historical context: the previously requested test was:

```text
backend/test/evolution.test.ts
uses Meta outbound provider for Evolution inbound while Meta is active
```

It now waits for both:

- the outbound row for `evolution-meta-outbound-1` to reach `sent`;
- a matching `whatsappClient.sendTextMessage` call for `15551112222@s.whatsapp.net` and `mock response`.

The final assertion selects that matching provider call instead of assuming the first global mock call belongs to this event.

The fixed Meta-provider test passes in isolation and in its full-suite position.

The complete Evolution suite was intermittently failing because tests could finish before their own fire-and-forget webhook processing had reached a definitive event-specific delivery state. This issue is resolved. The webhook tests now use staged event-specific synchronization:

- near-1 MiB event: `evolution-large-body-1` processed row, outbound row, `sent` status, and matching Meta provider call;
- Meta-provider event: `evolution-meta-outbound-1` outbound row, `sent` status, and matching provider call;
- unsupported-media event: `evolution-image-1` processed row, outbound row, `sent` status, and matching unsupported-response provider call.

This avoids unrelated asynchronous activity, global mock call counts, and `mock.calls[0]` assumptions. The full Evolution suite passed 13/13 in 13 repeated sequential runs.

The broader lifecycle design rationale remains documented because webhook processing is fire-and-forget:

- webhook routes return HTTP 200 before fire-and-forget processing finishes;
- dispatcher/provider mocks are shared within the suite;
- cleanup/reset can race with prior asynchronous processing;
- global mock call counts are sensitive to previous tests;
- the correct synchronization must be tied to each test’s own inbound message ID, outbound row, and provider call;
- each test must synchronize on its own inbound message ID, outbound row, and provider call.

The remaining next step is final diff review and explicit commit authorization only.

## 16. Immediate next work

1. Review the complete diff and confirm the Phase 2 files are limited to the schema, new migration, admin service/route, focused tests, frontend status integration, and handoff update in addition to prior intentional work.
2. Confirm no secrets, scratch files, PDFs, provider changes, AI changes, questionnaire changes, n8n changes, Docker/Caddy changes, or production deployment changes were introduced by Phase 2.
3. Do not commit or push without separate authorization.
4. No further validation is currently required; the final verified commands were:

```bash
cd backend
npm test
npm run build
npx prisma validate --schema src/prisma/schema.prisma
cd ..
git diff --check
```

5. Review the complete diff.
6. Stop and report results. Do not commit or push unless separately authorized.

## 17. Phase history and current phase status

| Phase | Main scope | Repository status |
|---|---|---|
| 1 | Backend foundation/local stack | Implemented |
| 2 | Deterministic questionnaire engine | Implemented; preserve |
| 3 | Prisma/PostgreSQL persistence | Implemented |
| 4 | Local simulator | Implemented |
| 5 | Bounded AI fallback | Implemented |
| 6 | n8n notifications/admin | Implemented |
| 7 | Production Docker/Caddy | Repository configuration implemented |
| 8 | Meta/Evolution/continuity/security foundations | Implemented in repository |
| 9 | WhatsApp inbound/outbound integration and reliability | Implemented and validated; final repository authorization/state remains |
| 10 | VPS, backups, restore, monitoring, handover | Repository foundation only; operational work pending |

CRM capability status:

- Phase 2 Lead Status: implemented, migrated, tested, and locally Docker-verified.
- Phase 3 Follow-ups: implemented, migrated to local Docker/test databases, focused-tested, and locally Docker-verified.
- Lead Status and Follow-up Status remain independent.

## 18. Phase 10 operational status

Implemented in the repository:

- production simulator protection;
- migration deployment service;
- readiness endpoint;
- Docker healthchecks;
- Evolution credential validation;
- n8n webhook authentication;
- admin login rate limiting;
- PII-safe provider logging;
- backup, restore, and restore-verification scripts.

Pending operational work:

- VPS provisioning/hardening;
- production environment/secrets;
- Restic/R2 initialization;
- first real backup;
- backup scheduling/alerts;
- disposable restore verification;
- full restore drill;
- RPO/RTO measurement;
- final production health verification;
- final handover.

See:

```text
docs/vps-phase10-pending.md
docs/backup-restore.md
ops/backup/backup.sh
ops/backup/restore.sh
ops/backup/verify-restore.sh
```

Do not claim AWS backups, AWS migration state, Evolution QR/session state, TLS, or live service health are verified from this repository. Those facts are currently unknown unless checked directly on the VPS.

## 19. AWS/deployment facts

The repository does not establish the current:

- AWS region;
- EC2 instance type;
- operating system;
- disk size/free space;
- public IP/DNS;
- security group;
- domain/TLS state;
- Docker/Compose version;
- live container state;
- Evolution QR/connection state;
- actual production migration table.

These are **UNKNOWN** from repository evidence.

Never include or request production credentials in a handoff document. Production secrets must remain host-only.

## 20. Scope protections

For the current work, do not modify:

- questionnaire engine;
- questionnaire wording or flow;
- Prisma schema;
- existing migrations;
- Meta provider architecture;
- Evolution provider architecture;
- webhook routing;
- outbound outbox semantics;
- n8n workflows;
- admin architecture;
- frontend application logic;
- Docker architecture;
- Caddy routing;
- production secrets;
- AI behavior, except verifying that completed arbitrary messages do not call AI.

Do not implement Conversation Continuity beyond the finalized completed-conversation contract already described here.

Do not add:

- generic chatbot behavior;
- growing phrase-based acknowledgement lists;
- completed-state AI classification;
- legal/IP guesses;
- unrelated refactors;
- optional improvements while closing the current blocker.

## 21. Commit/push/deploy policy

Current work must remain uncommitted and unpushed until:

1. the Evolution test issue is fixed;
2. the full backend test suite passes sequentially;
3. build, Prisma validation, and `git diff --check` pass;
4. the exact diff is reviewed;
5. explicit authorization is given to commit.

After approval, use the required commit trailer:

```text
Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
```

Never deploy unreviewed or uncommitted source. Deploy only the exact reviewed commit.

## 22. Resume checklist for the next agent

```text
[ ] Read this file completely.
[ ] Run git status --short.
[ ] Inspect git diff -- backend/src/services/conversationService.ts.
[ ] Inspect git diff -- backend/test/continuity.test.ts backend/test/db.test.ts.
[ ] Inspect git diff -- backend/test/evolution.test.ts backend/test/simulator.test.ts.
[ ] Run the Evolution Meta-provider test in isolation.
[ ] Run the full Evolution suite.
[ ] Fix only event-specific test synchronization if required.
[ ] Run backend npm test sequentially.
[ ] Run backend build.
[ ] Run Prisma validate.
[ ] Run git diff --check.
[ ] Confirm only intended files changed.
[ ] Do not commit or push without authorization.
```

## 23. Bottom line

The repository is a production-tested deterministic WhatsApp IP enquiry agent with Meta and Evolution support. The finalized completed-enquiry safety behavior and Evolution test synchronization work are implemented and validated. The working tree is intentionally not clean because the five reviewed changes and this handoff document remain uncommitted pending final authorization.

There is no active Evolution test blocker. The next agent should perform any remaining final repository-state review, preserve the validated changes, and stop before commit or push unless explicitly authorized.

## 24. Change log

### 2026-10-02 14:48 (+05:30)

- Updated `backend/test/evolution.test.ts` so the near-1 MiB test stages synchronization on its own processed row, outbound row, `sent` status, and matching Meta provider call.
- The Meta-provider and unsupported-media tests retain event-specific synchronization.
- Near-1 MiB and unsupported-media tests passed in isolation.
- Full Evolution suite passed 13/13 in 13 repeated sequential runs.
- `git diff --check` passed.
- No production source, provider implementation, or other test file was changed in this task.
- No commit or push was performed.

### 2026-10-02 14:55 (+05:30)

- Investigated the reported `whatsappDelivery.test.ts` explicit retryable provider failure.
- Confirmed the production path is correct: `failed` with `retryable: true` reaches `markRetryable`, transitioning the claimed row from `sending` to `retryable`.
- The reported `pending` state did not reproduce with the repository test setup.
- Isolated explicit retryable test passed.
- Full backend `npm test` passed, including the complete 10-test outbound delivery suite.
- Backend build passed.
- `git diff --check` passed.
- No production or test source was changed for this investigation; no commit or push was performed.

### 2026-10-02 15:04 (+05:30)

- Completed the final review of the five intentional tracked changes.
- Confirmed current Git state includes the five modified tracked source/test files plus untracked `PROJECT_HANDOFF.md`.
- Confirmed tracked diff statistics are 5 files changed, 131 insertions, and 38 deletions.
- Confirmed `git diff --check` passes.
- Confirmed focused Evolution tests passed.
- Confirmed the full Evolution suite passed 13/13 in 13 repeated sequential runs.
- Confirmed WhatsApp outbound delivery passed 10/10, including the explicit retryable-provider-failure test.
- Confirmed full backend `npm test` and backend build passed.
- Prisma validation is recorded as passed from the latest validation record.
- Evolution synchronization is resolved and is no longer an active blocker.
- No production/provider source was changed during the Evolution investigation.
- No commit or push was performed.

### 2026-10-02 15:45 (+05:30)

- Completed the WhatsApp questionnaire mobile-number change.
- Removed the active `shared_mobile` question so the flow proceeds directly from Email to City/Country.
- Populated the existing `shared_mobile`/Lead `mobile` value from the WhatsApp sender identity, including Evolution JID normalization.
- Preserved persisted mobile decoding for dashboard output.
- Updated focused DB, simulator, n8n, and answer-decoder tests; all passed.
- Backend build, Prisma validation, and `git diff --check` passed.
- The full backend suite had one intermittent Evolution near-1 MiB synchronization timeout; an independent Evolution rerun passed 13/13. No Evolution or provider source was changed for the mobile task.
- A final full backend `npm test` rerun passed with all test files green.
- No commit or push was performed.

### 2026-10-02 16:17 (+05:30)

- Added the first frontend/product UX pass for the Lead Management CRM.
- Reworked the authenticated shell with Overview, Leads, Incomplete Conversations, Follow-ups, and Settings navigation.
- Added an operational Overview using real `/admin/stats`, `/admin/leads`, and `/admin/conversations` responses.
- Added a dedicated Leads workspace with real search, service filtering, pagination, loading, empty, and error states.
- Improved lead and incomplete-conversation detail pages with human-readable sections and responsive layouts.
- Added transparent unavailable-state pages for Follow-ups and Settings because the current backend does not expose persistence or APIs for those features.
- Added restrained responsive CRM styling, accessible labels, focus states, and skeleton/error states.
- No backend, WhatsApp, questionnaire, AI, schema, migration, provider, Docker, or n8n files were changed for this frontend pass.
- Frontend build passed; lint has one pre-existing warning in `frontend/src/lib/api.ts` and no errors.
- No commit or push was performed.

### 2026-10-02 16:49 (+05:30)

- Fixed local frontend API routing by setting `frontend/.env.local` to `/api` and making `frontend/src/lib/api.ts` default to `/api` with normalized endpoint joining.
- Preserved production behavior because the production Compose build already supplies `NEXT_PUBLIC_API_URL=/api`.
- Updated the Overview to distinguish successful empty responses from failed API requests; failed loads now retain explicit error/unavailable states instead of rendering zero-data empty states.
- No backend, Caddy, provider, questionnaire, AI, Prisma, n8n, or Docker files were changed.

### 2026-10-02 16:51 (+05:30)

- Verified that `frontend/next.config.ts` originally had no `/api/*` rewrite; direct local requests returned Next.js 404 responses.
- Added a development-only Next.js `/api/*` route handler that forwards to Caddy at `https://localhost/api/*`, preserving request cookies and login `Set-Cookie` headers.
- The local proxy uses a development-only TLS relaxation for Caddy's local certificate; it returns 404 when `NODE_ENV` is not `development`.
- Production behavior remains unchanged: the rewrite is disabled when `NODE_ENV` is not `development`, and production Compose still supplies `/api`.
- Endpoint probes reached Caddy/backend and returned real `401 Unauthorized` responses without an admin cookie rather than 404; authenticated browser requests use the existing cookie flow.

### 2026-10-02 18:03 (+05:30)

- Investigated the authenticated local CRM `401` behavior.
- The Docker backend runs with `NODE_ENV=production`, so `/admin/login` sets `auth_token` with `Secure; HttpOnly; SameSite=Lax; Path=/`.
- When the frontend is served over `http://localhost:3000`, the browser cannot store/send that Secure cookie, even though the Next rewrite correctly reaches Caddy/backend.
- Changed only the local `frontend` dev script to serve HTTPS using the existing local Caddy `localhost` certificate and key. The local CA remains trusted by the Next proxy through `NODE_EXTRA_CA_CERTS`.
- Added local certificate artifacts to `frontend/.gitignore`.
- Production backend cookie security, Docker configuration, Caddy configuration, and authentication behavior remain unchanged.
- Local login verification succeeded with the configured admin account: the response set `auth_token` with `Secure; HttpOnly; SameSite=Lax; Path=/`, and authenticated requests returned real Docker data.

### 2026-10-02 19:57 (+05:30)

- Reviewed the local HTTPS development artifacts before commit.
- Added explicit ignore rules for `frontend/caddy-localhost.crt` and `frontend/caddy-localhost.key`; the local CA bundle remains ignored by the existing `caddy-local-*.crt` rule.
- Confirmed the local HTTPS Next.js server and development `/api/*` proxy remain active without application behavior changes.
- Authenticated local requests returned `200` for stats, leads, and incomplete conversations.
- No commit or push was performed.

### 2026-10-02 20:07 (+05:30)

- Refined the frontend CRM presentation without changing application behavior or API contracts.
- Added display-only WhatsApp identity formatting: Indian individual numbers render as `+91 70047 57990`, group JIDs render as `WhatsApp group`, and simulator/test identities remain recognizable.
- Applied the formatter to incomplete-conversation list/detail views and Indian phone formatting to lead detail.
- Improved incomplete-conversation detail hierarchy and collected-answer visibility while keeping unsupported service/activity actions absent.
- No backend, provider, authentication, questionnaire, AI, persistence, Docker, Caddy, Prisma, or n8n behavior changed.
- Validation: frontend build passed; frontend lint passed with the existing `frontend/src/lib/api.ts` internal-navigation warning; `git diff --check` passed.

### 2026-10-02 20:18 (+05:30)

- Started Phase 2 CRM backend foundation for persisted Lead status.
- Added the `LeadStatus` Prisma enum and `NEW` default to `Lead`; created `20261002202000_add_lead_status/migration.sql` without modifying existing migrations.
- Added protected, strict `PATCH /admin/leads/:id/status` support with authentication, allowlist validation, unknown-lead handling, and status in both existing Lead GET responses.
- Preserved manager-selected status during questionnaire/Lead upserts because the Lead repository update payload does not include status.
- Connected the Lead list and detail UI to the persisted status; detail updates use the protected endpoint and show explicit failure state.
- Added focused admin and database assertions for defaults, transitions, validation, authentication, persistence, and status preservation.
- Prisma generation, schema validation, backend build, frontend lint/build, and `git diff --check` passed. At that point backend tests were awaiting the authorized local migration; no database-mutating command had yet been run.

### 2026-10-02 20:23 (+05:30)

- Applied the tracked migrations to the local development database, local test database, and local Docker application database using `prisma migrate deploy` / the existing Compose `backend-migrate` service. No production or AWS database was touched.
- Rebuilt and restarted only the local Docker backend so the running CRM used the Phase 2 implementation.
- Confirmed 12 existing Docker Leads were preserved and defaulted to `NEW`; no application data was intentionally deleted.
- Authenticated local CRM verification passed: Lead list/detail and incomplete-conversation APIs returned `200`; an existing Lead persisted `NEW → CONTACTED → QUALIFIED` across reloads.
- Confirmed the linked completed conversation remained completed with unchanged customer/questionnaire data and that 16 incomplete conversations remained available.
- Focused admin tests passed, the final full backend suite passed, the Evolution suite passed 13/13 independently, backend build passed, Prisma validation/migration status passed, frontend lint/build passed, and `git diff --check` passed.
- One earlier full-suite run reproduced the known intermittent Evolution synchronization timeout; the final full-suite rerun passed with zero failures. No Evolution/provider production code was changed.

### 2026-10-02 20:36 (+05:30)

- Implemented Phase 3 persistent CRM Follow-ups.
- Added `FollowUpStatus` (`PENDING`, `COMPLETED`, `CANCELLED`), the `FollowUp` model and Lead relation, indexes for Lead/status/scheduled time, and migration `20261002203600_add_follow_ups`.
- Added protected admin APIs for listing/filtering, creating, rescheduling, completing, and cancelling Follow-ups with Lead/date/body validation.
- Replaced the frontend Follow-ups unavailable placeholder with real Today, Upcoming, Overdue, and Completed groups, creation, rescheduling, completion, cancellation, loading, empty, and error states.
- Added persisted Follow-ups to Lead detail while keeping activity history explicitly unavailable.
- Focused admin tests passed 15/15. The final full backend suite passed all files; earlier attempts showed the existing intermittent Evolution synchronization timeout, with no Evolution/provider changes made.
- Local Docker CRUD verification passed: create `201`, list `200`, reschedule `200`, complete `200`, persisted read `200`. Existing Docker data remained intact.
- Frontend lint/build, backend build, Prisma validation, and `git diff --check` passed. No commit, push, deploy, or production/AWS database change was performed.

### 2026-10-02 14:32 (+05:30)

- Declared `PROJECT_HANDOFF.md` the canonical living project record.
- Required every future code, test, configuration, infrastructure, migration, deployment, validation, risk, decision, commit, and push change to be recorded here.
- Added the rule that unverified facts must be marked **UNKNOWN**.
- No source code, tests, configuration, database, commit, or push was changed in this update.

### 2026-10-02 15:25 (+05:30)

- Implemented the Phase 4 CRM-only Notes and Activity History foundation.
- Added `ActivityType`, `InternalNote`, and `Activity` Prisma models plus Lead relations and migration `20261002204500_add_crm_notes_activity`; prior migrations were not modified.
- Added protected Notes APIs: list/create by Lead, update, and delete. Added protected per-Lead Activity API. Validation covers authentication, Lead/Note existence, non-empty content, and the 5000-character note limit.
- Added transactional activity creation for Lead status changes, Follow-up creation/rescheduling/completion/cancellation, and Note add/edit/delete. Repeated unchanged status actions do not create duplicate activities.
- Added real Lead Detail Notes and Activity sections with loading, error, empty, create/edit/delete, and chronological timeline states. No Notes or Activities are sent to WhatsApp, n8n, or questionnaire flows.
- Focused admin tests pass 16/16. Backend build and Prisma validation pass. Frontend lint/build pass with the existing `frontend/src/lib/api.ts` warning. `git diff --check` passes.
- Applied the Phase 4 migration to the authorized local Docker application database and local test database only. Docker data verification remains 12 Leads and 27 Conversations; Notes and Activities were initially empty.
- Rebuilt/restarted the local Docker backend and authenticated Notes/Activity endpoint smoke tests returned `200`; note creation returned `201`. The temporary local verification note was created only to verify the route and is not a production record.
- The final full backend suite had the known intermittent Evolution synchronization failure (11/13 Evolution tests in that run); all other test files passed. No Evolution/provider code was changed.
- No commit, push, deploy, production/AWS database change, or database reset was performed.

### 2026-10-02 20:53 (+05:30)

- Polished the Phase 5 CRM integration using existing APIs only.
- Overview now shows real pending/overdue Follow-ups, recent Lead status badges, and a status-mix summary derived from the loaded Lead records; API failure remains an explicit unavailable state.
- Leads now show formatted phone numbers and color-coded persisted CRM statuses.
- Incomplete Conversations now provide explicit error/retry states and a collected-answer progress indicator while remaining separate from completed Leads and CRM actions.
- Follow-up create, reschedule, complete, and cancel flows refresh from the API after mutation so grouping stays authoritative.
- Added responsive presentation refinements for status summaries, queue cards, progress bars, phone cells, and mobile Follow-up/detail layouts.
- Only frontend CRM screens/styles and this handoff record were changed for Phase 5; no backend, Prisma, WhatsApp, questionnaire, AI, provider, n8n, Docker, or production files were modified.
- Frontend lint/build passed with the existing `frontend/src/lib/api.ts` warning. Backend build and Prisma validation passed. `git diff --check` passed.
- Full backend regression reproduced the known intermittent Evolution synchronization failure: 12/13 Evolution tests passed in that run. Independent Evolution rerun reproduced only the unsupported-media synchronization timeout at 12/13; no Evolution code was changed.
- No commit, push, deploy, or database mutation was performed.

### 2026-10-02 21:05 (+05:30)

- Fixed the WhatsApp group-JID mobile edge case in `conversationService.ts`: identities ending in `@g.us` now persist an empty `shared_mobile` value instead of a group identifier, while individual WhatsApp JIDs retain normalized sender-number persistence.
- Added focused database coverage for both individual sender mobile persistence and group identity exclusion.
- Focused database tests passed 15/15. Full backend validation, backend build, Prisma validation, frontend lint/build, and `git diff --check` were rerun.
- The full backend suite reproduced one known intermittent Evolution synchronization failure: `accepts a valid webhook body near the 1 MiB route limit`. No Evolution/provider code was changed.
