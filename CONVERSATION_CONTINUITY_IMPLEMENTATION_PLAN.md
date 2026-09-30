Conversation Continuity Implementation Plan
Modify backend/src/services/conversationService.ts

Status: Plan only. No implementation, test, schema, migration, database, commit, or push is authorized by this document.  
Approved source: CONVERSATION_CONTINUITY_AUDIT.md, Whats app automation.pdf, and the current committed repository.

1. Objective

Add deterministic Conversation Continuity as a small orchestration layer around the existing ConversationService.

The implementation must:

Send the exact PDF welcome introduction followed by the existing engine Q1 for a brand-new conversation.
Continue incomplete conversations normally while their last activity is younger than 24 hours.
Prompt for Continue/New at or beyond 24 hours for incomplete conversations.
Prompt completed conversations at or beyond 24 hours with:
1. Yes, start a new enquiry
2. No, I need help with my previous enquiry
Reuse the same Conversation.
Preserve the existing one-Lead-per-Conversation behavior.
Keep the questionnaire engine, AI fallback, WhatsApp transport, simulator route, admin behavior, n8n, Docker, Caddy, schema, and migrations unchanged.

2. Architecture

REQUIRED implementation work

Implement continuity before the existing processMessage call in:

backend/src/services/conversationService.ts

The service will remain the single orchestration point for both:

backend/src/routes/simulator.ts
backend/src/routes/whatsapp.ts

The existing sequence remains intact for ordinary questionnaire messages:

Load or create the existing conversation.
Resolve continuity commands/prompts.
If no continuity decision consumes the message, call the frozen engine.
Run the existing AI fallback only for ordinary engine-invalid choice input.
Persist state through the existing repository.
Upsert a Lead only when the engine reports completion.

Prefer pure helper functions within conversationService.ts for age classification, metadata extraction, prompt construction, and safe summaries. Create a separate helper file only if the implementation materially improves testability without introducing a broader abstraction.

FROZEN architecture

Do not modify:

backend/src/engine/engine.ts
backend/src/engine/questions.ts
backend/src/engine/constants.ts
backend/src/engine/types.ts
Prisma schema or migrations
WhatsApp routes/client/parser/signature handling
simulator/admin routes
AI providers/fallback behavior
n8n, Docker, Caddy, frontend, or external services

3. State machine / flow

Use Conversation.updatedAt and the fixed threshold:

STALE_AFTER_MS = 24 * 60 * 60 * 1000
stale = now - updatedAt >= STALE_AFTER_MS

No timezone-specific logic, scheduler, or background process is required.

New conversation

Create the normal single Conversation row.
Return the exact PDF welcome introduction followed by the existing QUESTIONNAIRE.main_menu response.
Do not pass the first incoming greeting/message to the engine.
Leave the next engine state at the existing main-menu/Q1 starting state.
Do not call AI, create a Lead, or create a second Conversation.

The exact welcome text must be copied from the PDF, not reconstructed or paraphrased:

Welcome to GenioBrain IP Solution!
Thank you for connecting with us. We help startups, businesses, researchers, universities and innovators protect and manage their Intellectual Property (IP) through:
Patents
Trademarks
Designs
Copyrights
To help us understand your requirement and connect you with the right IP professional, please answer a few quick questions.
It will take only 2–3 minutes.

Q1 must continue to come from the existing QUESTIONNAIRE.main_menu definition.

Incomplete conversation younger than 24 hours

Do not send a welcome message.
Do not send a Continue/New prompt.
Pass the message unchanged to the existing engine and existing AI fallback path.
Preserve currentQuestionId and data as currently handled.

Incomplete conversation at or beyond 24 hours

If no pending continuity decision exists:

Build the safe structured summary.
Store _conversationMeta.continuityPrompt = "incomplete" in the existing Conversation.data.
Return the deterministic Continue/New prompt without invoking the engine or AI.

The prompt must identify the two decisions clearly; its exact product wording must be approved before implementation because the PDF does not define this prompt. The implementation must not use option IDs that can be confused with a questionnaire answer when the prompt is pending; use the approved continuity decision values 1 and 2.

If a pending incomplete prompt exists:

1 → clear the pending marker and return the existing current-question response without consuming a questionnaire answer.
2 → clear old incomplete questionnaire data, set currentQuestionId to main_menu, set isCompleted to false, clear continuity metadata, and return the existing Q1 response.
Any other non-command input → return a deterministic invalid-continuity response followed by the same prompt; do not call AI.

Completed conversation younger than 24 hours

Preserve current behavior. Do not introduce a new completed-enquiry prompt for this age range. Non-command input continues through the existing engine behavior, subject to the current AI fallback rules.

Completed conversation at or beyond 24 hours

If no pending prompt exists:

Store _conversationMeta.continuityPrompt = "completed".
Return the deterministic already-submitted prompt:

1. Yes, start a new enquiry
2. No, I need help with my previous enquiry

The surrounding wording must be approved before implementation because the PDF specifies the existing HELP behavior but not this continuity prompt.

If a pending completed prompt exists:

1 → clear continuity metadata, set currentQuestionId to main_menu, set isCompleted to false, preserve the same Conversation ID, and return Q1.
2 → clear the pending marker and return the existing HELP_INFO response exactly.
Any other non-command input → repeat the deterministic completed prompt without AI.

The implementation must use the displayed 1/2 labels as the stable input contract and document it in tests. It must not ambiguously treat ordinary questionnaire option IDs as continuity decisions.

4. File-by-file changes

REQUIRED implementation work


Add only orchestration logic for:

- New-conversation welcome handling.
- `updatedAt` age classification.
- Pending continuity prompt detection.
- Incomplete Continue/New decisions.
- Completed Start New/HELP decisions.
- Global command priority.
- Safe summary generation.
- Metadata stripping/restoration around engine calls.
- Preventing AI invocation for continuity decisions.
- Ensuring metadata never enters Lead answers.

Keep the existing engine call, AI fallback condition, repository update, Lead upsert, and n8n behavior unchanged for ordinary questionnaire transitions.

#### Modify `backend/test/continuity.test.ts`

This file is currently an untracked continuity test specification. During implementation, replace/extend it with deterministic tests described in §9. Do not weaken existing committed tests. Keep all database writes restricted to the isolated test database guard already used by the backend tests.

### CREATE only if materially necessary

Prefer no new file. If pure logic becomes too large or difficult to test safely, create:

- `backend/src/services/conversationContinuity.ts`

That helper may contain only pure continuity functions:

- stale-age classification
- metadata validation
- safe answer allowlisting/formatting
- prompt construction
- exact command-decision parsing

It must not access Prisma, call AI, call WhatsApp, create Leads, or change engine definitions.

### Do not modify

- `backend/src/engine/*`
- `backend/src/db/repositories/*`, unless implementation proves a narrowly scoped read/update helper is unavoidable
- `backend/src/ai/*`
- `backend/src/routes/whatsapp.ts`
- `backend/src/whatsapp/*`
- `backend/src/routes/simulator.ts`
- `backend/src/routes/admin.ts`
- `backend/src/engine/answerDecoder.ts`
- `backend/src/prisma/schema.prisma`
- `backend/src/prisma/migrations/*`
- `docker-compose*.yml`
- `caddy/Caddyfile`
- `.env*`
- `n8n/workflows/*`
- frontend files
- `Whats app automation.pdf`

## 5. Continuity metadata design

### REQUIRED implementation work

Use an internal namespaced object inside `Conversation.data` only for pending orchestration state:

```text
_conversationMeta: {
  continuityPrompt: "incomplete" | "completed"
}
```

Do not store raw prompt text, contact details, free-text answers, credentials, or sensitive content in metadata.

Metadata handling rules:

1. Read and validate `_conversationMeta` defensively; unknown values are treated as no pending prompt.
2. Never include `_conversationMeta` in a Lead payload.
3. Never include `_conversationMeta` in a user-facing summary.
4. Remove `_conversationMeta` before invoking the frozen engine.
5. Restore only valid metadata after an engine transition if a prompt remains pending.
6. Clear metadata on Continue, Start New, HELP resolution, and ordinary completion.

The engine’s `main_menu` transition mutates its `data` object and deletes non-`shared_` keys other than `flowType`. Therefore the service must pass the engine a metadata-free copy and merge metadata back explicitly, rather than trusting engine output to preserve `_conversationMeta`.

For a Start New decision, clear all old questionnaire data, including prior `flowType`, before returning Q1. Do not retain contact fields or free-text answers from the abandoned enquiry.

For ordinary completion, construct `Lead.answers` from questionnaire data with continuity metadata removed. The existing one-Lead-per-Conversation upsert remains unchanged.

## 6. Safe-summary design

### REQUIRED implementation work

Build an explicit allowlist of structured, non-contact answer IDs from the current questionnaire definitions. Safe entries may include structured choice answers describing categories, stages, usage, disclosure, services, assistance, and communication preference.

Exclude all of the following:

- Free-text descriptions:
  - `patent_desc`
  - `trademark_desc`
  - `design_product`
  - `notsure_desc`
  - `trademark_class`
- Personal/contact fields:
  - `shared_name`
  - `shared_org`
  - `shared_email`
  - `shared_mobile`
  - `shared_city`
  - `shared_phone_time`
- `flowType`
- `_conversationMeta`
- Any unknown key or invalid answer value.

Use the current `QUESTIONNAIRE` definitions to map approved choice IDs to labels. Reuse the label-extraction logic conceptually from `answerDecoder.ts`, but do not change admin decoding behavior merely to support continuity.

The summary must be:

- deterministic
- bounded
- structured
- safe when no allowlisted answers exist
- free of raw free-text and personal data

If there are no safe answers, omit the summary section rather than displaying an empty or misleading list.

## 7. Command handling

### REQUIRED implementation work

Commands must be checked before continuity decision parsing:

- `HELP` → return existing `ENGINE_CONFIG.HELP_INFO`; preserve existing conversation data and do not invoke AI.
- `SERVICES` → return existing `ENGINE_CONFIG.SERVICES_INFO`; preserve existing conversation data and do not invoke AI.
- `CONSULTATION` → return existing `ENGINE_CONFIG.CONSULTATION_INFO`; preserve existing conversation data and do not invoke AI.
- `BACK` → delegate to the existing engine behavior so it returns the existing Q1/main-menu response and marks the state incomplete; continuity must not reinterpret it as a numeric decision.
- `1`/`2` while an incomplete prompt is pending → resolve that prompt only.
- `1`/`2` while a completed prompt is pending → resolve the completed decision contract only.
- Any other input while a prompt is pending → repeat the current prompt with a deterministic invalid-choice message.

No continuity input may reach AI fallback. AI remains available only after continuity has been resolved and ordinary engine processing has resumed.

## 8. Lead behavior

### REQUIRED implementation work

- New conversations and continuity prompts never create Leads.
- Continue never creates or updates a Lead.
- Start New from an incomplete conversation abandons only the old in-progress data in the same Conversation; it does not create a Lead.
- Start New from a completed conversation resets the same Conversation and does not create a Lead until the new questionnaire completes.
- HELP from a completed stale conversation does not create or update a Lead.
- On the new questionnaire’s eventual completion, retain the current `leadRepository.upsertFromConversation(conversation.id, leadData)` behavior.
- Do not create a second Conversation or alter the unique `(channel, externalUserId)` behavior.
- Clear continuity metadata before constructing `leadData.answers`.

The existing one-Lead-per-Conversation design means a completed reset can overwrite the existing Lead on later completion. This is an accepted constraint of the no-schema-change plan and must be covered by tests.

## 9. Test plan

### REQUIRED implementation work later — do not write tests in this planning task

Use the isolated test database only for database-backed tests. Use fixed timestamps or repository fixtures; do not sleep to cross the 24-hour boundary.

#### Welcome and age behavior

1. New conversation returns the exact PDF welcome followed by the existing Q1 text.
2. The next message is processed as Q1 by the unchanged engine.
3. Incomplete conversation at `23:59:59` continues normally without a prompt.
4. Incomplete conversation at exactly `24:00:00` is stale and receives Continue/New.

#### Incomplete continuity

5. Stale incomplete prompt contains only approved safe structured answers.
6. Free-text invention, business/product/service, product, technology, class, and not-sure descriptions are absent.
7. Contact/personal fields are absent.
8. `_conversationMeta` is absent from the displayed summary.
9. Continue preserves the same Conversation ID, `currentQuestionId`, and questionnaire data.
10. Start New clears old questionnaire data and returns Q1 using the same Conversation ID.
11. Start New from incomplete does not create a Lead.
12. Invalid incomplete decision repeats the same prompt and does not invoke AI.

#### Completed continuity

13. Completed conversation younger than 24 hours preserves current behavior.
14. Completed stale conversation returns the approved already-submitted prompt with decisions 1 and 2.
15. Completed stale + Start New reuses the same Conversation ID.
16. Completed stale + Start New does not create a Lead before the new questionnaire completes.
17. Completed stale + HELP returns the exact existing HELP response.
18. Completed stale + HELP does not create or update a Lead.
19. Completing the new questionnaire uses the existing one-Lead-per-Conversation upsert and does not create a second Lead.

#### Commands and invalid state

20. HELP during a pending incomplete prompt returns existing HELP.
21. SERVICES during a pending incomplete prompt returns existing SERVICES.
22. CONSULTATION during a pending incomplete prompt returns existing CONSULTATION.
23. BACK during a pending incomplete prompt returns existing BACK behavior.
24. The same four command cases are covered while a completed prompt is pending.
25. Invalid numeric/text continuity input deterministically repeats the active prompt.
26. Continuity decisions never invoke AI/Groq.
27. Missing or corrupt continuity metadata does not expose raw data and falls back deterministically.
28. Invalid/missing `currentQuestionId` does not leak stored answers.

#### Regression coverage

29. Existing AI fallback tests remain unchanged and pass.
30. Existing WhatsApp webhook, HMAC, async processing, and deduplication tests pass.
31. Existing simulator tests pass.
32. Existing engine tests pass unchanged.
33. Existing database persistence tests pass.
34. Existing admin/answer-decoder tests pass.
35. `_conversationMeta` is absent from persisted `Lead.answers` and admin decoded answers.

Each timestamp test must use a deterministic injected `now` or equivalent test seam. Do not alter production time semantics, use timezone-specific logic, or add a scheduler.

## 10. Regression protection

### REQUIRED implementation work

- Keep `processMessage` source and `QUESTIONNAIRE` definitions unchanged.
- Keep existing AI fallback condition and provider code unchanged.
- Keep WhatsApp deduplication before `ConversationService` unchanged.
- Keep simulator and WhatsApp calls routed through the same service.
- Keep `decodeAnswers` behavior unchanged.
- Assert exact existing HELP/SERVICES/CONSULTATION/BACK responses.
- Run the focused continuity tests and the complete existing backend suite against the isolated test database.
- Confirm no continuity metadata is included in Lead persistence or admin responses.

## 11. Risks

### REQUIRED implementation work

Resolve or explicitly accept these risks before release:

1. **Completed Lead overwrite:** reusing one Conversation means a later completion updates the existing Lead rather than retaining a historical submission.
2. **Concurrent stale requests:** two messages may observe the same pending/stale state without transaction or locking support. The implementation should document deterministic last-write behavior or obtain approval for a minimal repository-level guard without changing schema.
3. **Prompt wording:** the PDF does not define incomplete/completed continuity wording. Use product-approved exact strings before coding.
4. **Decision labels:** completed prompt labels are approved as 1/2, and the implementation must accept those displayed values literally. Tests must enforce this contract consistently.
5. **Engine metadata cleanup:** metadata must be removed before every engine call and restored only when valid.
6. **First-message behavior:** the welcome must be returned without changing the engine’s existing first-input semantics.

## 12. Implementation order

### REQUIRED implementation work

1. Confirm exact continuity prompt wording and completed decision input contract.
2. Add pure constants/types/helpers in `conversationService.ts` or a narrowly scoped helper if needed.
3. Add new-conversation welcome handling.
4. Add global-command precedence.
5. Add timestamp classification using `updatedAt` and the exact 24-hour boundary.
6. Add pending metadata parsing and metadata-free engine invocation.
7. Add incomplete Continue/New handling.
8. Add completed stale Start New/HELP handling.
9. Ensure Lead payloads exclude metadata and continuity prompts never call Lead upsert.
10. Add deterministic isolated-database continuity tests without weakening existing tests.
11. Run continuity, existing regression tests, build, and diff review.
12. Stop for review before commit; do not alter schema, migrations, or architecture.

## 13. Explicit OUT OF SCOPE

- Questionnaire engine rewrite or behavior changes outside the approved welcome/orchestration behavior.
- New or changed question definitions, wording, option IDs, or answer validation.
- AI/Groq/Gemini changes.
- Prisma schema, migration, table, index, or database changes.
- New API endpoints, external services, queues, Redis, schedulers, or microservices.
- WhatsApp webhook/client/parser/signature changes.
- n8n workflow or notifier changes.
- Docker, Caddy, frontend, admin UI, or deployment architecture changes.
- Historical Lead storage beyond the existing one-Lead-per-Conversation behavior.
- Deletion of the existing continuity test, scratch files, PDF, credentials, or other untracked files.
- Any commit or push during implementation.

## 14. Final acceptance criteria

Conversation Continuity implementation is acceptable only when:

1. New conversations return the exact PDF welcome and existing Q1.
2. Incomplete conversations younger than 24 hours continue unchanged.
3. Incomplete conversations at or beyond 24 hours show a deterministic safe Continue/New prompt.
4. Continue preserves state; Start New clears old data and reuses the same Conversation.
5. Completed conversations at or beyond 24 hours show the approved 1/2 prompt.
6. Completed Start New reuses the Conversation and delays Lead upsert until completion.
7. Completed HELP returns the existing HELP behavior without Lead changes.
8. HELP, SERVICES, CONSULTATION, and BACK retain priority and exact existing responses.
9. Invalid continuity choices repeat the active prompt without AI.
10. Safe summaries exclude all free-text, confidential, contact, personal, and metadata values.
11. `_conversationMeta` is never exposed through Lead answers or admin output.
12. No Prisma schema/migration/database change exists.
13. Engine, question definitions, option IDs, AI fallback, WhatsApp, simulator, n8n, Docker, Caddy, frontend, and admin behavior remain unchanged except for shared service orchestration.
14. Deterministic boundary and regression tests pass without weakening existing tests.
15. The final diff contains only approved Conversation Continuity files.

## OPTIONAL RECOMMENDATIONS

None. This plan intentionally avoids optional architectural expansion.
