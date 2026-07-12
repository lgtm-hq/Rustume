# RFC 0001: End-to-End Encryption for Cloud Resume Storage

| Field | Value |
| --- | --- |
| **Status** | Proposed |
| **Author(s)** | Rustume maintainers |
| **Created** | 2026-07-12 |
| **Related issues** | [#44](https://github.com/lgtm-hq/Rustume/issues/44) (parent), [#369](https://github.com/lgtm-hq/Rustume/issues/369) (this RFC), [#40](https://github.com/lgtm-hq/Rustume/issues/40) (CRDT evaluation), [#65](https://github.com/lgtm-hq/Rustume/issues/65) (public pages), [#91](https://github.com/lgtm-hq/Rustume/issues/91) (version history), [#334](https://github.com/lgtm-hq/Rustume/issues/334) (backups), [#338](https://github.com/lgtm-hq/Rustume/issues/338) (local↔cloud linking), [#353](https://github.com/lgtm-hq/Rustume/issues/353) (account export) |

## Status

**Proposed.** This document settles design questions before any encryption code is
written. Implementation sub-issues follow from the recommendation at the end.

## Context

Rustume Cloud stores resume documents as plaintext JSON in Postgres. The schema is
defined in `crates/server/src/db/migrations/001_initial.sql`:

```sql
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled',
    data JSONB NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT false,
    public_slug TEXT UNIQUE,
    password_hash TEXT,
    version INT NOT NULL DEFAULT 1,
    ...
);
```

The `data` column holds a serialized `ResumeData` object (`crates/schema/src/lib.rs`:
`basics`, `sections`, `metadata`). CRUD routes in `crates/server/src/routes/resumes.rs`
read and write this column directly. Listing resumes returns only `id`, `title`, and
`updated_at` — not the payload.

Authentication uses WorkOS AuthKit (`crates/server/src/auth/workos.rs`) with
server-side sessions (`crates/server/src/auth/session.rs`). There is **no user
password** stored or available for key derivation. WorkOS provides identity only.

The parent issue [#44](https://github.com/lgtm-hq/Rustume/issues/44) predates the
shipped architecture: it references a `crates/sync/` crate and "CRDT updates", neither
of which exist. Cloud sync today is authenticated REST CRUD from the web client
(`apps/web/src/stores/cloudStorage.ts`) with optimistic concurrency on the `version`
column (409 on conflict).

Several product docs describe encryption and features that are not yet implemented in
code:

- `apps/site/src/content/docs/cloud/encryption.md` — server-managed and optional E2E modes
- `docker/.env.example` — commented `ENCRYPTION_SECRET=` ("Phase 1.5+")
- `crates/storage/src/lib.rs` — `StorageConfig.encrypted: bool` (unused)
- `resume_versions` table exists but has no route writers/readers
- `is_public`, `public_slug`, `password_hash` columns exist but no publish API

This RFC grounds decisions in **what is shipped today** and classifies how each
planned feature interacts with E2EE.

## Threat model

### In scope — what E2EE protects against

| Threat | Mitigation |
| --- | --- |
| Postgres or backup compromise | Resume payloads are ciphertext; operator cannot read content without the user's secret |
| Curious or malicious operator | Same as above for stored data |
| Cross-tenant data leak via DB query | Ciphertext is useless without per-user/per-resume keys |
| Passive network observer of stored sync traffic | TLS protects in transit today; E2EE adds at-rest protection after TLS terminates |

### Out of scope — what E2EE cannot protect against

| Threat | Why |
| --- | --- |
| Compromised client device or browser extension | Attacker sees plaintext before encryption / after decryption |
| Malicious client JavaScript (XSS, supply-chain compromise) | Attacker can exfiltrate keys and plaintext |
| Server-side features that require plaintext | User explicitly sends decrypted data for render/export (transient exposure) |
| WorkOS account takeover | Attacker gains session access; can trigger client-side decrypt if keys are session-bound |
| Lost user secret with no recovery | Data is permanently unreadable — by design |

### Trust boundaries

```text
┌─────────────────────────────────────────────────────────────┐
│  Client (browser / future mobile)                           │
│  ┌─────────────┐   encrypt/decrypt   ┌──────────────────┐ │
│  │ ResumeData  │ ◄──────────────────► │ User-held secret │ │
│  │  (plaintext)│                      │ (passphrase /    │ │
│  └──────┬──────┘                      │  device key)     │ │
│         │                             └──────────────────┘ │
│         │ ciphertext envelope                              │
└─────────┼───────────────────────────────────────────────────┘
          │ HTTPS (TLS)
          ▼
┌─────────────────────────────────────────────────────────────┐
│  Rustume Cloud server                                       │
│  Stores envelope in resumes.data (or sibling column)        │
│  Cannot decrypt without user participation                  │
│  May receive transient plaintext for render/export routes   │
└─────────────────────────────────────────────────────────────┘
```

## Constraints

1. **No password-derived keys from auth.** WorkOS SSO provides OAuth identity, not a
   user password. Any KDF must use a separate user-chosen passphrase, device-held key
   material, or recovery codes — not the login credential.

2. **Server features assume readable JSON today.**
   - `POST /api/render/pdf` and `POST /api/render/preview` accept client-posted
     `ResumeData` JSON (`crates/server/src/routes/render.rs`). They do not load from
     the database, but the client must send plaintext for server-side Typst rendering.
   - `GET /api/resumes/export` and `GET /api/resumes/export/pdf` read `data` directly
     from Postgres (`crates/server/src/routes/export.rs`).
   - Future public pages (#65) and version history (#91) require server-readable
     snapshots unless redesigned.

3. **WASM cannot render PDFs.** `bindings/wasm` exposes parse, validate, and storage
   only — not `crates/render`. Server-side PDF generation stays on native Typst unless
   a separate client-side render path is built.

4. **No sync crate.** Encryption logic must live in a shared Rust crate (likely new
   `crates/crypto` or extension of `crates/schema`) with WASM bindings so web and
   future iOS/Android share the same envelope format.

5. **Optimistic concurrency must survive.** The `version` column on `resumes` is an OCC
   counter, not a content-version history. E2EE must not break PUT-with-version conflict
   detection in `apply_resume_update`.

6. **JSON validation limits apply to stored bytes.** `validate_resume_json` in
   `crates/server/src/validation/json_limits.rs` checks depth, string length, and byte
   size. Encrypted envelopes are opaque JSON objects; validation rules must distinguish
   plaintext resume JSON from ciphertext envelopes (see envelope format below).

7. **Cross-reference #40 (CRDT).** If CRDT sync is adopted later, the envelope must
   encrypt individual updates or CRDT state — not whole-document blobs that defeat
   merge semantics. This RFC specifies document-level encryption; a CRDT-specific
   envelope variant is an open follow-up.

## Options

### Key management schemes

| Option | Description | Pros | Cons |
| --- | --- | --- | --- |
| **A. Passphrase-on-top** | User sets an encryption passphrase independent of WorkOS login. Argon2id derives a master key (MK). | Simple mental model; works with SSO; no server key storage | Forgotten passphrase = data loss unless recovery codes exist; passphrase entry friction on every device |
| **B. Device-held key + wrapping** | Each device generates a random Data Encryption Key (DEK). DEK is wrapped by MK derived from passphrase, or by a device-specific key stored in secure enclave / IndexedDB non-exportable key. | Better UX after initial unlock; supports "remember on this device" | Key sync across devices requires wrapping key export or recovery flow; more implementation complexity |
| **C. Recovery codes** | On E2EE enable, server stores `hash(code)` plus encrypted DEK backups wrapped by each code. | Mitigates passphrase loss | Recovery codes are secrets users must store; server-held wrapped DEK backups are weaker than pure E2EE but required for recovery |
| **D. WorkOS-bound wrapping** | Derive wrapping key from WorkOS session or OIDC token. | No extra passphrase | **Rejected:** session tokens rotate and are server-visible; provides no meaningful E2EE |

**Recommendation:** Option A + B hybrid — passphrase-derived MK wraps a per-account DEK;
each device holds an unwrapped DEK in session memory (cleared on logout). Option C as
mandatory recovery flow when enabling E2EE.

### Scope: what is encrypted

| Data | Plaintext or ciphertext | Rationale |
| --- | --- | --- |
| `resumes.data` | **Ciphertext envelope** (when E2EE enabled) | Core PII — full resume document |
| `resumes.title` | **Plaintext** | Required for list UI (`GET /api/resumes` returns title only) |
| `resumes.id`, timestamps, `version` | **Plaintext** | Metadata and OCC |
| `resumes.is_public`, `public_slug` | **Plaintext flags** | Routing metadata; public content itself cannot be E2EE |
| `resume_versions.data` | **Same envelope as parent** | History snapshots must match parent encryption mode |
| Local IndexedDB (`apps/web/src/stores/persistence.ts`) | **User choice** | Local-only users unaffected; cloud users decrypt on load |

### Opt-in vs default

| Approach | Recommendation |
| --- | --- |
| **Opt-in per account** | **Recommended.** User explicitly enables E2EE, sets passphrase, saves recovery codes. Default remains plaintext for feature parity. |
| **Opt-in per resume** | Possible future extension; adds UI and conflict complexity when mixing modes. Defer to v2. |
| **Default-on E2EE** | **Rejected for v1.** Breaks server export, bulk PDF, and future public pages without explicit user consent and feature degradation messaging. |

## Crypto envelope specification

All E2EE resume payloads use a **versioned JSON envelope** stored in `resumes.data`
(reusing the existing JSONB column — no migration required for column type).

### Envelope format (v1)

```json
{
  "e2ee": {
    "version": 1,
    "nonce": "<base64url, 12 bytes>",
    "ciphertext": "<base64url, ChaCha20-Poly1305 encrypted ResumeData JSON>"
  }
}
```

| Field | Specification |
| --- | --- |
| **KDF** | Argon2id (RFC 9106). Default params: `m=19456` KiB, `t=2`, `p=1`. Params and salt live in `users.e2ee_config` (account-level), not per-resume. |
| **Key derivation** | `MK = Argon2id(passphrase, salt, params)` → 32 bytes. Account `DEK` is a random 32-byte value generated at E2EE enable and wrapped by MK (not derived from MK). |
| **AEAD** | ChaCha20-Poly1305 (RFC 8439). Key = account DEK. Nonce = 12 random bytes per encryption; **must never repeat** for a given DEK. |
| **Plaintext input** | Canonical JSON serialization of `ResumeData` (same as today). |
| **Detection** | Payload is an E2EE envelope only when the top-level object contains **only** an `e2ee` key (no `basics`, `sections`, or `metadata`). Server rejects mixed plaintext+ciphertext shapes and malformed envelopes (`e2ee.version`, `e2ee.nonce`, `e2ee.ciphertext` required) with 422. Valid envelopes skip resume-schema checks; byte-size limits still apply. |

### Per-account DEK wrapping (unlock flow)

1. On E2EE enable: generate random 32-byte DEK.
2. Derive MK from user passphrase via Argon2id.
3. Wrap DEK: `wrapped_dek = ChaCha20-Poly1305(MK, nonce_wrap, DEK)`.
4. Store `wrapped_dek` + KDF params in a new `users.e2ee_config JSONB` column (server
   stores wrapped key only — cannot unwrap without passphrase).
5. On unlock: client fetches `e2ee_config`, derives MK, unwraps DEK, holds DEK in memory.

### Recovery codes

On enable, client generates one-time recovery codes. For each code:

1. Derive `RK = HKDF-SHA256(code, info="rustume-recovery-v1")` → 32 bytes.
2. Encrypt DEK backup: `wrapped_dek_recovery = ChaCha20-Poly1305(RK, nonce, DEK)`.
3. Upload `wrapped_dek_recovery` to server; server stores `hash(code)` for verification
   **and** the ciphertext blob (operator cannot decrypt without the code).
4. On recovery: user submits code → server verifies hash → returns `wrapped_dek_recovery`
   → client derives RK, unwraps DEK, prompts new passphrase.

### Where the code lives

| Component | Location | Rationale |
| --- | --- | --- |
| Envelope serialize/deserialize | New `crates/crypto` | Keeps `crates/schema` free of crypto deps; shared by server (validation/detection) and clients |
| KDF + AEAD primitives | `crates/crypto` via `argon2`, `chacha20poly1305`, `hkdf` crates | Audited Rust crypto libraries |
| WASM bindings | `bindings/wasm` — `encrypt_resume`, `decrypt_resume`, `derive_master_key`, `wrap_dek`, `unwrap_dek` | Web client must encrypt before upload |
| Server routes | `crates/server` — detect envelope, skip plaintext validation, never decrypt | Server remains zero-knowledge for stored data |
| Future mobile | Same `crates/crypto` via FFI | Consistent envelope across platforms |

`crates/render` and `crates/server/src/routes/render.rs` remain unchanged — they
continue to accept plaintext JSON from the client.

## Feature compatibility matrix

Classification: **Keep** (works with E2EE), **Degrade** (works with client-side
decrypt + explicit plaintext handoff), **Exclude** (incompatible when E2EE enabled).

| Feature | Issue | Current behavior | E2EE enabled | Notes |
| --- | --- | --- | --- | --- |
| Resume CRUD + list | — | Plaintext `data` in Postgres | **Keep** | Ciphertext stored instead; title stays plaintext |
| Optimistic concurrency | — | `version` column, 409 on mismatch | **Keep** | Unaffected — version is metadata |
| Server PDF render (single) | — | Client posts plaintext to `POST /api/render/pdf` | **Degrade** | Client decrypts locally, posts plaintext per request. Transient server memory exposure. |
| Server PDF preview | — | Same as render | **Degrade** | Same transient exposure |
| Bulk JSON export | #353 | Server reads plaintext from DB | **Degrade** | Client-side export: fetch envelopes, decrypt, assemble JSON bundle locally |
| Bulk PDF export (ZIP) | #353 | Server reads DB + Typst render | **Degrade** | Client decrypts each resume, POSTs to render, or future client-side PDF |
| Public resume pages | #65 | Schema columns exist; no routes | **Exclude** | Public pages require server-readable HTML/OG metadata. Block publish when E2EE on. |
| Version history | #91 | Table exists; no writers | **Degrade** | Store encrypted snapshots in `resume_versions.data`. Server-side diff/preview requires client decrypt. No server-side restore preview. |
| Operator backups (`pg_dump`) | #334 | Full DB dump includes plaintext | **Keep** | Ciphertext backs up fine. Restore verification requires client decrypt smoke test, not server readability check. |
| Account export (GDPR) | #353 | Bulk export routes | **Degrade** | Export includes ciphertext envelopes + `e2ee_config`. User decrypts with passphrase. |
| Local↔cloud import | #338 | `POST /api/resumes/import` upserts by id | **Keep** | Client encrypts before import; server rejects non-envelope `data` when `e2ee_enabled`. Document id-preserving flow in linking RFC. |
| Local IndexedDB storage | — | WASM storage, no encryption | **Keep** | Independent of cloud E2EE; optional local encryption is separate scope |
| Server-managed at-rest encryption | — | Documented, not implemented (`ENCRYPTION_SECRET`) | **Orthogonal** | AES-256-GCM at rest protects against disk theft, not operator access. Complements but does not replace E2EE. |
| CRDT sync | #40 | Not implemented | **Degrade** | Document-level envelope is interim; CRDT adoption needs update-level encryption |
| Search / indexing | — | Not implemented | **Exclude** | Full-text search on encrypted payloads impossible without searchable encryption (out of scope) |

## Recommendation

**Adopt opt-in, account-level E2EE with a passphrase + recovery codes, storing
versioned ChaCha20-Poly1305 envelopes in the existing `resumes.data` JSONB column.**

### Decision log

| Decision | Choice | Rationale |
| --- | --- | --- |
| E2EE default | Opt-in | Preserves feature parity for users who need public pages, server export, and zero-friction multi-device access |
| Key derivation | Passphrase + Argon2id (not WorkOS password) | WorkOS provides no password; SSO and E2EE secrets must be independent |
| DEK model | Per-account DEK wrapped by passphrase-derived MK | Enables single unlock to encrypt/decrypt all resumes; simplifies key rotation |
| Storage | Envelope in existing `data` column | Avoids schema migration for column type; detection via `"e2ee"` wrapper |
| Code location | New `crates/crypto` + WASM bindings | Shared across web and future mobile; keeps schema crate pure |
| Public pages | Excluded when E2EE on | Cannot serve readable HTML from ciphertext without defeating E2EE purpose |
| Server render/export | Degraded (client decrypt → transient plaintext) | Acceptable trade-off for opt-in users; document transient exposure |
| Server-managed encryption | Proceed separately (Phase 1.5) | Addresses at-rest disk encryption, not operator access; orthogonal to E2EE |

### Decision triggers

| Trigger | Action |
| --- | --- |
| User enables E2EE in Account settings | Generate DEK, prompt passphrase + recovery codes, re-encrypt all resumes |
| User forgets passphrase, has recovery code | Unwrap DEK via recovery flow, prompt new passphrase |
| User forgets passphrase, no recovery | Data permanently lost — display clear warning at enable time |
| User requests public page on E2EE resume | Block with explanation; offer disable E2EE or duplicate resume without E2EE |
| CRDT (#40) accepted | File follow-up RFC for update-level envelope |
| Mobile app ships | Reuse `crates/crypto` via FFI; same envelope |

## Migration and rotation

### Enabling E2EE (plaintext → ciphertext)

1. Client verifies passphrase strength and displays recovery codes (user confirms saved).
2. Client generates DEK, wraps with MK, uploads `e2ee_config` and recovery backups to server.
3. Client fetches all resumes (plaintext), encrypts each to v1 envelope, PUTs back.
4. Server atomically verifies every resume row is a valid envelope **and** commits
   `e2ee_enabled = true` in one transaction. During this step, resume writes for the
   account are rejected unless the payload is a valid envelope (blocks TOCTOU from
   concurrent tabs or older clients).
5. Audit event recorded (`crates/server/src/audit/`).

All steps are client-driven; server never sees passphrase or unwrapped DEK.

### Disabling E2EE (ciphertext → plaintext)

1. User provides passphrase (or recovery code).
2. Client decrypts all resumes, PUTs plaintext JSON.
3. Server atomically verifies every resume row is plaintext JSON and clears
   `e2ee_config` / sets `e2ee_enabled = false` in one transaction (reject toggle if
   any row is still an envelope or a PUT failed). During this step, resume writes must
   be plaintext.

Requires explicit user action — not reversible by operator alone.

### Passphrase rotation

1. User provides old passphrase.
2. Client unwraps DEK with old MK.
3. User provides new passphrase.
4. Client re-wraps same DEK with new MK, updates `e2ee_config`.
5. Resume envelopes unchanged (DEK unchanged) — no re-encryption of all resumes.

### DEK rotation (compromise recovery)

1. Generate new DEK.
2. Re-encrypt every resume envelope with new DEK.
3. Re-wrap new DEK with current MK, update `e2ee_config`.
4. Re-encrypt each recovery-code backup so every `wrapped_dek_recovery` unwraps the
   new DEK, or invalidate and regenerate recovery codes before completing rotation.
5. Increment `e2ee_config.key_generation` counter.

### Existing plaintext rows

No forced migration. Plaintext and E2EE accounts coexist. Individual resume rows on
an E2EE account must all be envelopes once migration completes (atomic per-account
toggle).

## Open questions

1. **Session persistence of DEK.** How long should the unlocked DEK live in browser
   memory? Options: per-tab session, `sessionStorage` timeout, or require passphrase
   on each visit. Security vs UX trade-off.

2. **Multi-device key transfer.** QR code export of wrapped DEK, manual recovery code
   entry, or "trust this device" flow with additional auth factor?

3. **E2EE + server-managed encryption stacking.** Encrypt envelope with server DEK
   *and* client DEK (defense in depth) or client-only for true zero-knowledge?

4. **Import from plaintext local storage.** When enabling E2EE, should local IndexedDB
   copies also be encrypted locally, or remain plaintext on device?

5. **Envelope in `resume_versions`.** Same envelope format, or version-specific nonce
   tracking to prevent nonce reuse across history snapshots?

6. **Subscription / billing interaction.** Does E2EE affect plan limits (storage size
   of ciphertext ≈ plaintext + overhead)?

## Spawned issues

If this RFC is accepted, file the following implementation sub-issues:

| # | Title | Scope |
| --- | --- | --- |
| 1 | `feat(crypto): add crates/crypto with v1 envelope` | Argon2id, ChaCha20-Poly1305, HKDF, envelope serialize/deserialize, tests with test vectors |
| 2 | `feat(wasm): expose encrypt/decrypt bindings` | `bindings/wasm` wrappers for web client |
| 3 | `feat(server): E2EE account config column and detection` | `users.e2ee_config`, strict envelope detection/rejection in validation middleware, reject non-envelope writes when `e2ee_enabled` |
| 4 | `feat(web): E2EE enable/disable/ unlock UI` | Account settings, passphrase entry, recovery code display, DEK session management |
| 5 | `feat(web): encrypt on cloud save, decrypt on load` | `cloudStorage.ts` integration with WASM crypto |
| 6 | `feat(web): client-side bulk export for E2EE accounts` | Replace server-side JSON/PDF export when `e2ee_enabled` |
| 7 | `feat(server): block public page publish for E2EE resumes` | Guard `is_public` toggle when account has E2EE |
| 8 | `docs: update encryption.md to match RFC 0001` | Align user-facing docs with decided design |
| 9 | `feat(server): server-managed at-rest encryption (Phase 1.5)` | Separate from E2EE — `ENCRYPTION_SECRET`, AES-256-GCM on `data` column for non-E2EE accounts |
| 10 | `feat(server): version history with E2EE snapshots` | Implement `resume_versions` writers per #91, storing same envelope format |

---

*This RFC replaces the implementation sketch in [#44](https://github.com/lgtm-hq/Rustume/issues/44)
for design purposes. Implementation tracking continues in [#44](https://github.com/lgtm-hq/Rustume/issues/44)
and the spawned sub-issues above.*
