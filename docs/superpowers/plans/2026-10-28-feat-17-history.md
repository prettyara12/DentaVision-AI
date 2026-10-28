# feat(history): Riwayat & Hapus Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement user scan & chat history, saved result viewing without re-inference, and data/account deletion with Storage-first security rules for issue #17.

**Architecture:** Server Components fetch user data through Supabase server clients enforcing RLS. Scans and heatmaps are stored in private Supabase Storage and records are kept in Postgres (`scans`, `chats`, `chat_messages`). Deletion strictly deletes Storage objects first before deleting database records.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Tailwind CSS v4, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-feat-17-history-design.md`

## Global Constraints

- Conventional Commits with English prefix and Indonesian description, without any AI attribution footer.
- Follow "Lightbox" design system: bone background in light areas, hairline borders, Geist & Geist Mono fonts, WCAG 2.2 AA contrast.
- Antislop during implementation: no em dashes (`—`) in UI copy, no meaningless icons/emoji, full keyboard accessibility, light/dark themes, 360 px mobile responsiveness.
- Deletion rule: Delete Storage objects first; if Storage deletion fails, do NOT delete database rows and return error.
- Zod validation: Every database read of `detections` must be validated with Zod.
- Signed URLs for saved scan images must have a 1-hour expiration.

---

### Task 1: Supabase Database Types & Client Helpers

**Files:**
- Create: `web/src/lib/supabase/database.types.ts`
- Create: `web/src/lib/supabase/admin.ts`
- Modify: `web/src/lib/supabase/server.ts`
- Test: `web/src/lib/supabase/server.test.ts`

**Interfaces:**
- Produces:
  - `Database` type in `database.types.ts`
  - `createAdminClient(): SupabaseClient<Database>` in `admin.ts`
  - Typed `createClient(): Promise<SupabaseClient<Database>>` in `server.ts`

- [ ] **Step 1: Generate database.types.ts**
Run `npx supabase gen types typescript --linked` and write to `web/src/lib/supabase/database.types.ts`.

- [ ] **Step 2: Create createAdminClient helper**
Implement `web/src/lib/supabase/admin.ts` using `createClient` from `@supabase/supabase-js`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 3: Update server.ts with Database typing**
Import `Database` into `web/src/lib/supabase/server.ts` and pass to `createServerClient<Database>`.

- [ ] **Step 4: Add unit tests**
Create `web/src/lib/supabase/server.test.ts` testing `hasAuthCookie`, `createAdminClient`, and typing.

- [ ] **Step 5: Verify tests and commit**
Run `cd web && npx vitest run src/lib/supabase/server.test.ts`.
Commit: `feat(db): generate types supabase dan client admin`

---

### Task 2: Storage & Database History Operations Module

**Files:**
- Create: `web/src/features/history/data.ts`
- Test: `web/src/features/history/data.test.ts`

**Interfaces:**
- Produces:
  - `saveScanUpload(supabase, userId, scanId, imageBytes, result): Promise<void>`
  - `deleteScan(supabase, userId, scanId): Promise<{ ok: boolean; error?: string }>`
  - `deleteChat(supabase, userId, chatId): Promise<{ ok: boolean; error?: string }>`
  - `deleteAccount(adminClient, supabase, userId): Promise<{ ok: boolean; error?: string }>`
  - `getUserScans(supabase, userId): Promise<UserScanSummary[]>`
  - `getUserChats(supabase, userId): Promise<UserChatSummary[]>`
  - `getScanDetail(supabase, userId, scanId): Promise<ScanDetail | null>`

- [ ] **Step 1: Write unit tests in data.test.ts**
Cover successful upload, storage-then-db deletion order, storage failure preventing DB delete, and zod validation of detections.

- [ ] **Step 2: Implement history data operations in data.ts**
Implement `saveScanUpload`, `deleteScan`, `deleteChat`, `deleteAccount`, `getUserScans`, `getUserChats`, `getScanDetail` with proper error handling and Zod validation.

- [ ] **Step 3: Run tests and verify**
Run `cd web && npx vitest run src/features/history/data.test.ts`.

- [ ] **Step 4: Commit**
Commit: `feat(history): modul operasi data riwayat dan hapus storage-db`

---

### Task 3: Route Handlers DELETE & Updates to POST Scans / Chat / Insight

**Files:**
- Create: `web/src/app/api/scans/[id]/route.ts`
- Create: `web/src/app/api/scans/[id]/route.test.ts`
- Create: `web/src/app/api/chats/[id]/route.ts`
- Create: `web/src/app/api/chats/[id]/route.test.ts`
- Create: `web/src/app/api/account/route.ts`
- Create: `web/src/app/api/account/route.test.ts`
- Modify: `web/src/app/api/scans/route.ts`
- Modify: `web/src/app/api/scans/route.test.ts`
- Modify: `web/src/app/api/chat/route.ts`
- Modify: `web/src/app/api/insight/route.ts`

**Interfaces:**
- Produces:
  - `DELETE /api/scans/[id]` -> 204 No Content
  - `DELETE /api/chats/[id]` -> 204 No Content
  - `DELETE /api/account` -> 204 No Content
  - `POST /api/scans` -> accepts `save` param (default "true"), saves to Storage+DB if logged in, returns `{ type: "result", result, scanId? }`
  - `POST /api/chat` -> accepts `chatId?` / `scanId?`, persists turns for logged-in user, returns `{ type: "done", chatId? }`
  - `POST /api/insight` -> accepts `scanId?`, updates scan record on done

- [ ] **Step 1: Implement DELETE /api/scans/[id] and tests**
Validate auth, ownership, Storage delete first then DB delete.

- [ ] **Step 2: Implement DELETE /api/chats/[id] and tests**
Validate auth, ownership, DB delete.

- [ ] **Step 3: Implement DELETE /api/account and tests**
Validate auth, Storage prefix delete then `auth.admin.deleteUser`.

- [ ] **Step 4: Update POST /api/scans to save scan for logged-in users**
Check `currentUser()`, check `save !== "false"`, call `saveScanUpload`, emit `scanId`.

- [ ] **Step 5: Update POST /api/chat & POST /api/insight to persist data**
In `/api/chat`, save user message and assistant message to `chats` & `chat_messages` if user is logged in. In `/api/insight`, update `scans.insight` when `scanId` is given.

- [ ] **Step 6: Run tests and verify**
Run `cd web && npx vitest run src/app/api/`.

- [ ] **Step 7: Commit**
Commit: `feat(api): endpoint delete scan, chat, account dan simpan data login`

---

### Task 4: UI `/history` Page & Translations

**Files:**
- Create: `web/src/app/[lang]/history/page.tsx`
- Create: `web/src/features/history/history-view.tsx`
- Create: `web/src/features/history/delete-modal.tsx`
- Modify: `web/src/components/site-header.tsx`
- Modify: `web/messages/id.json`
- Modify: `web/messages/en.json`
- Test: `web/src/features/history/history-view.test.tsx`

**Interfaces:**
- Produces:
  - Page `/[lang]/history`
  - Nav links for "Riwayat" (`/history`) and "Pengaturan" (`/settings`) in `SiteHeader`
  - Translations for history keys

- [ ] **Step 1: Add i18n translation messages**
Add keys for `history.*`, `settings.*`, `delete.*` in both `messages/id.json` and `messages/en.json`.

- [ ] **Step 2: Implement DeleteModal component**
Accessible modal dialog with ESC to close, backdrop click, focus management, and cancel/confirm buttons.

- [ ] **Step 3: Implement HistoryView component**
Tabs for "Scan Gigi" and "Percakapan", thumbnail with 1h signed URL, date format, red attention finding count badge, empty states with CTA, and delete confirmation modal.

- [ ] **Step 4: Update SiteHeader navigation**
Add links to `/[lang]/history` and `/[lang]/settings` for authenticated users.

- [ ] **Step 5: Implement app/[lang]/history/page.tsx**
Server component checking authentication, redirecting to login if guest, querying scans and chats, and passing to `HistoryView`.

- [ ] **Step 6: Test HistoryView and commit**
Run `cd web && npx vitest run src/features/history/`.
Commit: `feat(history): halaman riwayat scan dan chat dengan tab dan konfirmasi hapus`

---

### Task 5: UI `/scans/[id]` and `/chats/[id]` Pages

**Files:**
- Create: `web/src/app/[lang]/scans/[id]/page.tsx`
- Create: `web/src/app/[lang]/chats/[id]/page.tsx`
- Modify: `web/src/features/scan/scan-flow.tsx`
- Test: `web/src/app/[lang]/scans/[id]/page.test.tsx`

**Interfaces:**
- Produces:
  - Saved scan result page at `/[lang]/scans/[id]`
  - Saved chat page at `/[lang]/chats/[id]`
  - Automatic navigation in `ScanFlow` to `/[lang]/scans/[id]` when scanId is returned

- [ ] **Step 1: Implement app/[lang]/scans/[id]/page.tsx**
Server component: verify auth, load scan from DB, validate detections with Zod, get 1-hour signed URL for original image, load heatmaps, load related chat, render `ResultWorkspace`.

- [ ] **Step 2: Update ScanFlow to redirect to /scans/[id] when saved**
If `event.scanId` is present in `result` event, navigate to `/${lang}/scans/${event.scanId}` instead of `/scan/result`.

- [ ] **Step 3: Implement app/[lang]/chats/[id]/page.tsx**
Server component: verify auth, load chat and messages, if `scan_id` exists load scan context, render `GeneralChat` with existing messages.

- [ ] **Step 4: Add tests and verify**
Run `cd web && npx vitest run src/app/[lang]/scans/`.

- [ ] **Step 5: Commit**
Commit: `feat(scan): halaman rute scans id dan chats id tersimpan`

---

### Task 6: UI `/settings` Page (Account Info & Delete Account)

**Files:**
- Create: `web/src/app/[lang]/settings/page.tsx`
- Create: `web/src/features/settings/settings-view.tsx`
- Create: `web/src/features/settings/delete-account-modal.tsx`
- Test: `web/src/features/settings/settings-view.test.tsx`

**Interfaces:**
- Produces:
  - Page `/[lang]/settings`
  - Account info display (email, registration date)
  - Danger zone with text-confirmation modal ("HAPUS" / "DELETE") calling `DELETE /api/account`

- [ ] **Step 1: Implement DeleteAccountModal**
Modal dialog with warning explanation, text input requiring typing "HAPUS" (ID) or "DELETE" (EN), delete button disabled until text matches, calling `DELETE /api/account` and redirecting to landing on success.

- [ ] **Step 2: Implement SettingsView & app/[lang]/settings/page.tsx**
Server Component checks auth, queries profile/user, renders `SettingsView`.

- [ ] **Step 3: Test SettingsView and commit**
Run `cd web && npx vitest run src/features/settings/`.
Commit: `feat(settings): halaman pengaturan akun dan modal hapus akun permanen`

---

### Task 7: Full Verification & Integration Quality Check

**Files:**
- Sync: `docs/roadmap.md`, `README.md`

- [ ] **Step 1: Run comprehensive lint, typecheck, tests, and build**
Run:
`cd web && npm run lint && npm run typecheck && npm test && npm run build`
Ensure 0 lint errors, 0 type errors, all tests pass, build succeeds.

- [ ] **Step 2: Verify UI and Antislop compliance**
Check 360 px viewport responsiveness, keyboard navigation, light/dark mode contrast, ID/EN locales.

- [ ] **Step 3: Synchronize affected documentation**
Update `docs/roadmap.md` and `README.md` with issue #17 completion status.

- [ ] **Step 4: Final commit & prepare PR**
Commit: `docs: sinkronkan roadmap dan status pengerjaan issue 17`
Push branch `feat/17-history` and open PR to `development`.
