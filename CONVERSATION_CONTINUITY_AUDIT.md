# Conversation Continuity Audit

**Audit date:** 2026-09-29  
**Repository:** `0xyusufz/whatsapp-ip-agent`  
**HEAD:** `889f327` — `Add Meta WhatsApp Cloud API integration`  
**Scope:** audit/report only. No application, test, schema, migration, database, Git, or deployment changes were made.

## 1. Executive summary

Conversation Continuity can be added without a Prisma schema change, migration, new table, external service, AI call, questionnaire-engine rewrite, or WhatsApp route redesign. The safest insertion point is an orchestration layer at the beginning of `ConversationService.handleMessage`, with the existing engine remaining responsible for ordinary questionnaire transitions.

The existing `Conversation` fields are sufficient:

- `createdAt` / `updatedAt` provide the 24-hour age check.
- `currentQuestionId`, `data`, and `isCompleted` preserve the questionnaire state.
- The unique `(channel, externalUserId)` constraint preserves one conversation per channel/user.

The main implementation constraint is that `engine.processMessage` mutates the supplied data object when processing `main_menu`: it removes every key except `shared_*` and `flowType`. If temporary continuity metadata is stored in `Conversation.data`, the orchestration layer must remove it before invoking the engine and restore it after the transition, or otherwise ensure the engine cannot erase it. This can be done without changing the engine.

The current working tree contains untracked `backend/test/continuity.test.ts`, which documents desired behavior but fails against the current application because continuity is not implemented. It was not modified.

## 2. Current architecture relevant to continuity

Observed committed flow:

1. `simulatorRoutes` and `whatsappRoutes` both call `conversationService.handleMessage(channel, externalUserId, message)`.
2. `ConversationService` loads or creates one `Conversation`.
3. It reconstructs `ConversationState` from `currentQuestionId`, `data`, and `isCompleted`.
4. It calls `processMessage`.
5. It may invoke AI fallback only after the engine returns an invalid choice.
6. It persists the returned state through `conversationRepository.updateState`.
7. On completion it upserts the single `Lead` for that conversation and may notify n8n.
8. WhatsApp deduplicates Meta message IDs before calling the service; simulator behavior is independent of WhatsApp transport.

The admin API reads completed `Lead.answers` and passes them through `decodeAnswers`; it does not expose `Conversation.data` directly.

## 3. PDF/questionnaire findings

### REQUIREMENTS FROM THE PDF

The extracted authoritative PDF text states:

- Exact welcome introduction:

  > Welcome to GenioBrain IP Solution!  
  > Thank you for connecting with us. We help startups, businesses, researchers, universities and innovators protect and manage their Intellectual Property (IP) through:  
  > Patents  
  > Trademarks  
  > Designs  
  > Copyrights  
  > To help us understand your requirement and connect you with the right IP professional, please answer a few quick questions.  
  > It will take only 2–3 minutes.

- Exact Q1 wording/options:

  > Q1. What type of IP protection are you looking for?  
  > Please reply with the number:  
  > 1. Patent  
  > 2. Trademark  
  > 3. Design Registration  
  > 4. Copyright  
  > 5. Not sure – I need guidance

- Patent Q5 explicitly warns:

  > Please do not share confidential information or trade secrets at this stage.

- The “Not sure” path asks for a 2–3 sentence description.
- Final details collect name, organization/company, email, mobile, city/country, and preferred communication.
- The final message documents:
  - `HELP – Speak to our team 9284333589 (Mon to Fri 9.30 to 6.30)`
  - `SERVICES – Explore our IP services www.geniobrain.com`
  - `CONSULTATION – Request a consultation`
  - `BACK – Return to the main menu`
- The final warning says not to share confidential technical information, unpublished research data, passwords, or sensitive documents through automated chat.

The PDF does not document Conversation Continuity, a 24-hour rule, Continue/New prompts, completed-enquiry prompts, or the proposed wording for those prompts. Those behaviors are therefore design decisions to validate separately, not PDF requirements.

### FACTS OBSERVED IN THE REPOSITORY

`backend/src/engine/questions.ts` matches the PDF questionnaire structure and wording closely. `ENGINE_CONFIG` contains the existing command and completion text. The engine currently has no welcome-only transition.

## 4. Current `ConversationService` behavior

`ConversationService.handleMessage` currently:

- Creates a conversation on the first message.
- Passes the first message directly to the engine at `main_menu`; therefore `hi` is treated as an invalid Q1 answer rather than a welcome-only turn.
- Continues incomplete conversations using their persisted `currentQuestionId` and `data`.
- Treats a completed conversation as starting from `main_menu` because the engine maps `isCompleted` to `main_menu`.
- Runs AI fallback only for deterministic invalid choices at choice questions.
- Upserts the existing conversation’s Lead on completion, using the unique `conversationId`.
- Sends n8n only when the loaded conversation was not already completed.

There is no age check, continuity decision state, welcome state, completed-user prompt, or reset orchestration.

## 5. Current engine behavior relevant to continuity

### FACTS OBSERVED IN THE REPOSITORY

- Global commands are checked before current-question processing:
  - `HELP`
  - `SERVICES`
  - `CONSULTATION`
  - `BACK`
- `BACK` returns the main menu and marks the state incomplete while retaining data.
- A null question ID or completed state resolves to `main_menu`.
- Choice answers must match an option ID exactly before AI fallback is considered by the service.
- Text answers must be non-empty.
- `optional_text` has no special validation branch and therefore accepts any input, including empty input.
- When `main_menu` selects a different flow, the engine deletes all data keys except `shared_*` and `flowType`.

The engine must remain frozen. Continuity should not add synthetic question IDs to the engine or alter question definitions.

## 6. Proposed insertion point

Implement continuity in `ConversationService.handleMessage`, before the ordinary `processMessage` call:

1. Load or create the conversation as today.
2. Recognize global commands before continuity prompts, preserving existing command priority.
3. Determine whether the conversation is new, incomplete, or completed and whether `updatedAt` is below, above, or exactly at the 24-hour threshold.
4. If a persisted continuity decision is pending, interpret only the explicit Continue/New or completed-enquiry choice.
5. Otherwise, emit the appropriate welcome or continuity prompt.
6. For normal questionnaire input, delegate unchanged to the existing engine and AI fallback.
7. Persist only the resulting normal state plus any namespaced orchestration metadata.

No WhatsApp route change is needed. Both WhatsApp and simulator calls already converge on this service.

## 7. Existing fields/data that can be reused

### FACTS OBSERVED IN THE REPOSITORY

- `createdAt` is available but is not the correct activity timestamp for continuity after a user has replied.
- `updatedAt` is automatically maintained by Prisma and is the appropriate last-activity timestamp.
- `currentQuestionId` identifies the next engine question.
- `data` contains questionnaire answers and `flowType`.
- `isCompleted` distinguishes incomplete and submitted conversations.
- The unique channel/user key prevents a second conversation for the same channel/user.

### PROPOSED DESIGN

Use a namespaced JSON object such as `_conversationMeta` inside `Conversation.data` only if a pending decision must survive a request:

```text
_conversationMeta: {
  continuityPrompt: "incomplete" | "completed",
  promptedAt: ISO timestamp
}
```

This metadata is orchestration state, not questionnaire answer data. Before calling the frozen engine for a new root answer, remove or temporarily separate `_conversationMeta`; after the engine returns, restore it if still needed. A safer implementation may keep the metadata in a local service variable during the prompt request and persist it only while a decision is pending.

When a user chooses Continue, clear the pending marker and pass no synthetic answer to the engine; return the existing question represented by `currentQuestionId`. When a user chooses Start New, clear the incomplete questionnaire answer data, set `currentQuestionId` to `main_menu`, set `isCompleted` false, clear the pending marker, and return the existing Q1 response. For a completed conversation, retain the existing Lead row and reset only the conversation state; the unique Lead relation means a subsequent completion updates that row rather than creating a second Lead.

## 8. Proposed state flow

### New conversation

- Send the exact PDF welcome introduction followed by the existing Q1 response.
- Persist a state that makes the next user message an answer to Q1 without invoking AI for the welcome turn.
- Do not create a second conversation.

The implementation must decide whether the welcome turn is represented by an explicit metadata marker or by creating the conversation with `currentQuestionId = main_menu` and returning before engine processing. The latter avoids engine changes and is preferable.

### Incomplete conversation younger than 24 hours

- Do not send a welcome or Continue/New prompt.
- Call the existing engine with the user’s message.
- Preserve the existing state and answer data.

### Incomplete conversation at or beyond 24 hours

- Treat exactly 24 hours as stale (`age >= 24 hours`).
- Build a summary only from safe structured answers.
- Do not display invention, business/product/service, product, technology, or other free-text descriptions.
- Store a pending incomplete-continuity decision.
- Continue restores the existing state.
- Start New clears the old incomplete questionnaire data and starts Q1 in the same conversation.

### Completed conversation younger than 24 hours

The current engine treats a non-command message as input at `main_menu` and can begin another enquiry after a completed conversation. Continuity should not unnecessarily alter that existing behavior unless the approved product requirement explicitly requires a prompt for this age range. The audit requirement says to inspect, not redesign, this case; preserve current behavior for `<24h`.

### Completed conversation at or beyond 24 hours

- Show an already-submitted-enquiry prompt with:
  1. Start a new enquiry.
  2. Use existing HELP/human-support behavior for the previous enquiry.
- Choice 1 resets the same conversation to Q1 without creating a second conversation.
- Choice 2 delegates to the existing HELP response.
- Do not invoke AI to interpret this decision.
- Do not create or upsert a Lead merely because the user says `hi`.

## 9. Safe continuation-summary strategy

### PROPOSED DESIGN

Use the existing `QUESTIONNAIRE` definitions and `decodeAnswers` logic as the source of labels/options, but do not pass the entire answer object to a generic decoder for display. Build an explicit allowlist of safe structured question IDs by question definition/type and flow:

- Safe candidates are choice answers whose question text/options describe category, stage, usage, disclosure, service, assistance, or communication preference.
- Exclude every `text` and `optional_text` question, including:
  - `patent_desc`
  - `trademark_desc`
  - `design_product`
  - `notsure_desc`
  - `trademark_class`
  - shared personal/contact fields
  - `shared_phone_time`
- Exclude `_conversationMeta` and `flowType` from user-facing summary.
- Decode allowed choice IDs using `decodeAnswers`-equivalent option-label logic so display remains aligned with current question definitions.

The summary should show only a bounded, deterministic list of allowlisted entries. If no safe entries exist, show the continuation choice without an empty or misleading summary.

`decodeAnswers` is currently used by the admin API and accepts arbitrary answer keys; it must not be changed to become the continuity policy because that could change admin behavior. Reuse its label logic through a separate continuity helper or a narrowly scoped helper extraction, subject to later implementation review.

## 10. Global-command interaction

Global commands must retain their current priority and must not be consumed as continuity choices:

- `HELP`: return the existing help response and do not force a continuity decision.
- `SERVICES`: return the existing services response and do not clear state.
- `CONSULTATION`: return the existing consultation response and do not clear state.
- `BACK`: return the existing main-menu response and mark the questionnaire incomplete, consistent with the engine; clear or retain continuity metadata according to the explicit product decision, but do not change engine semantics.

If a continuity prompt is pending and the user sends an invalid non-command response such as `3`, return a deterministic invalid-continuity response that repeats the prompt. Do not call AI.

## 11. Edge cases

- **Exactly 24 hours:** use `updatedAt <= now - 24h` as stale; tests must inject deterministic timestamps rather than sleep.
- **Corrupt or incomplete data:** if `currentQuestionId` is missing or not present in `QUESTIONNAIRE`, do not expose raw data; clear only continuity metadata and fall back to the existing main-menu response, with a server log for the invalid persisted state.
- **Corrupt `data` JSON:** treat it as no safe summary and preserve only valid state that can be reconstructed; do not silently invent answers.
- **Pending prompt plus HELP/BACK/SERVICES/CONSULTATION:** global command behavior wins.
- **Completed reset:** reset the existing conversation; do not create a new one. The existing Lead remains linked by unique `conversationId`; completion uses upsert.
- **Duplicate Lead risk:** a normal reset can update the existing Lead, not create a second one. The implementation must not call lead creation during a prompt or reset.
- **WhatsApp deduplication:** continuity runs after `whatsappRoutes` deduplicates the Meta message ID, so it should not affect deduplication.
- **AI fallback:** continuity decisions must return before engine/AI processing; ordinary questionnaire messages retain existing AI behavior.
- **Simulator:** simulator and WhatsApp share the same service, so both receive identical continuity behavior.
- **Admin dashboard:** `_conversationMeta` must never be included in `Lead.answers` or decoded admin answers. Completed Lead answers should remain questionnaire data only.
- **Concurrent messages:** two stale messages could race on the same conversation. The current repository has no transaction/locking abstraction; this is a production risk that must be resolved or explicitly accepted before implementation.
- **First-message semantics:** the PDF requires welcome followed by Q1, while current engine tests define first `hi` as an invalid Q1 answer. Continuity implementation must add a welcome orchestration turn without changing engine semantics.

## 12. Test strategy

### TESTS TO ADD LATER — DO NOT ADD IN THIS AUDIT

Use fixed timestamps and repository/service mocks or isolated database fixtures:

1. New conversation returns the exact PDF welcome plus existing Q1; next input is processed as Q1.
2. Incomplete conversation at `23:59:59` continues normally without a prompt.
3. Incomplete conversation at exactly `24:00:00` receives Continue/New.
4. Incomplete stale conversation summary contains only safe structured answers.
5. Patent/trademark/design/not-sure free-text answers never appear in the summary.
6. Continue preserves `currentQuestionId` and answer data.
7. Start New clears old incomplete flow data, retains no stale metadata, and returns Q1.
8. Completed stale conversation returns the already-submitted prompt.
9. Completed stale conversation Start New reuses the same conversation ID and does not create a Lead before completion.
10. Completed stale conversation HELP returns the exact existing HELP response and does not create/update a Lead.
11. HELP, SERVICES, CONSULTATION, and BACK bypass a pending continuity decision according to the approved command policy.
12. Invalid continuity response repeats the decision without AI.
13. Corrupt/missing question state does not leak raw data and falls back deterministically.
14. `_conversationMeta` is not persisted into completed `Lead.answers` or exposed through admin decoded answers.
15. Existing AI fallback tests remain green for ordinary questionnaire choices.
16. Existing WhatsApp webhook/dedup tests remain green.
17. Existing simulator, engine, database, admin, and answer-decoder tests remain green.
18. Exact-boundary tests use fixed `Date`/timestamp inputs rather than real-time sleeps.
19. Duplicate completion/reset scenarios verify the unique conversation-to-Lead relation.

## 13. Exact files likely to change

### PROPOSED DESIGN

Likely implementation files:

- `backend/src/services/conversationService.ts` — orchestration, age classification, prompt handling, reset/continue state.
- A new narrowly scoped helper such as `backend/src/services/conversationContinuity.ts` — only if extracting pure prompt/summary logic improves testability without changing architecture.
- New or extended continuity tests, preferably `backend/test/continuity.test.ts`.

Potentially touched only if a small shared helper is extracted without behavior change:

- `backend/src/engine/answerDecoder.ts` — avoid changing admin semantics; prefer not to modify.

No Prisma schema or migration file is required.

## 14. Exact files that should remain untouched

- `backend/src/engine/engine.ts`
- `backend/src/engine/questions.ts`
- `backend/src/engine/constants.ts`
- `backend/src/engine/types.ts`
- `backend/src/services/conversationRepository.ts` (not the actual path; repository is under `backend/src/db/repositories/`)
- `backend/src/db/repositories/conversationRepository.ts` unless a narrowly scoped timestamp/state helper is proven necessary
- `backend/src/db/repositories/leadRepository.ts`
- `backend/src/routes/whatsapp.ts`
- `backend/src/whatsapp/*`
- `backend/src/routes/simulator.ts`
- `backend/src/routes/admin.ts`
- `backend/src/services/adminLeadService.ts`
- `backend/src/engine/answerDecoder.ts`
- `backend/src/prisma/schema.prisma`
- `backend/src/prisma/migrations/*`
- `docker-compose*.yml`
- `caddy/Caddyfile`
- `.env*`
- `n8n/workflows/*`
- frontend application files
- `Whats app automation.pdf`

The PDF is authoritative input only and must not be modified.

## 15. Risks

1. **Prompt-state persistence:** metadata in `Conversation.data` can be erased by the frozen engine’s root-flow cleanup unless orchestration isolates and restores it.
2. **Lead semantics:** reusing a completed conversation updates the existing Lead; product owners should confirm whether historical submissions should overwrite or snapshot the same Lead row. A new table is forbidden by the current architecture rule.
3. **Concurrent stale messages:** without a transaction or lock, two requests can both present/accept a continuity prompt.
4. **Exact wording:** the PDF does not specify continuity prompt wording, summary format, or Continue/New labels. Those need product approval before implementation.
5. **Safe summary allowlist:** question IDs and answer types must be explicitly allowlisted; generic display of all `data` is unsafe.
6. **Completed `<24h>` behavior:** current behavior starts engine processing at `main_menu`; changing it would be a behavioral decision not supplied by the PDF.
7. **Existing test conflict:** the untracked continuity test expects welcome and stale prompts, while current committed behavior intentionally treats first `hi` as invalid Q1. Those tests are not evidence that implementation is complete.
8. **PDF extraction fidelity:** the extracted PDF has spacing/typographical inconsistencies, but the substantive wording is clear. Exact customer-facing strings should be copied from the source text, not reconstructed from tests.

## 16. Required implementation constraints

- Add orchestration only; do not rewrite or modify the questionnaire engine.
- Use exact PDF welcome text and existing questionnaire/command text.
- Do not invoke AI for continuity prompts or decisions.
- Do not change option IDs, question definitions, engine validation, or existing AI fallback.
- Reuse the existing conversation row and preserve its unique channel/user identity.
- Do not create a new Lead on a prompt, Continue, or Start New decision.
- Keep continuity metadata namespaced and exclude it from Lead answers and admin output.
- Explicitly exclude free-text and contact data from any user-facing continuation summary.
- Keep WhatsApp deduplication and outbound behavior unchanged.
- Preserve simulator behavior except for the intentionally shared continuity behavior.
- Use deterministic time inputs at the exact 24-hour boundary in tests.
- Resolve or explicitly document concurrent-request semantics before production release.

## 17. Schema/migration decision

**Schema and migration changes are unnecessary for the proposed feature.** Existing `createdAt`, `updatedAt`, `currentQuestionId`, `data`, and `isCompleted` are sufficient. Do not add columns, tables, indexes, or migrations.

## 18. Questionnaire engine decision

**The questionnaire engine can remain frozen.** All continuity behavior can be implemented before/after the existing `processMessage` call in `ConversationService`, provided orchestration protects any temporary metadata from the engine’s root-flow cleanup.

## 19. Open questions / risks requiring approval

1. What exact client-approved wording should be used for incomplete and completed continuity prompts? The PDF does not specify it.
2. Should Start New after a completed enquiry overwrite the existing Lead row on resubmission, or is historical lead retention required? Historical retention conflicts with the current unique one-Lead-per-Conversation design and the no-schema-change constraint.
3. Should `BACK` while a continuity decision is pending cancel the prompt and return Q1, or simply return the normal engine main menu while preserving the stale-state decision?
4. What concurrency behavior is acceptable when two messages arrive while one continuity prompt is pending?

## 20. Audit verdict

The feature is technically feasible as a small additive service-orchestration layer with no schema or migration changes. Implementation should not begin until continuity prompt wording, completed-lead overwrite semantics, and pending-command behavior are approved. Conversation Continuity remains separate from the committed Phase 9 Meta WhatsApp integration.
