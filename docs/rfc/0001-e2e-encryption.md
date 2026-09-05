# RFC 0001: End-to-End Encryption for Cloud Resume Storage

| Field              | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**         | Draft                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Author(s)**      | Rustume maintainers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Created**        | 2026-07-12                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Related issues** | [#44](https://github.com/lgtm-hq/Rustume/issues/44) (parent), [#369](https://github.com/lgtm-hq/Rustume/issues/369) (this RFC), [#40](https://github.com/lgtm-hq/Rustume/issues/40) (CRDT evaluation), [#65](https://github.com/lgtm-hq/Rustume/issues/65) (public pages), [#91](https://github.com/lgtm-hq/Rustume/issues/91) (version history), [#334](https://github.com/lgtm-hq/Rustume/issues/334) (backups), [#338](https://github.com/lgtm-hq/Rustume/issues/338) (local↔cloud linking), [#353](https://github.com/lgtm-hq/Rustume/issues/353) (account export) |

## Status

**Draft, amended by [RFC 0003](./0003-local-first-encrypted-storage.md).** This
document settles the envelope, key hierarchy, recovery, and rotation design. Where the
two disagree, RFC 0003 wins; the overridden decisions here are marked in place and
are, in short: encryption is on by default rather than opt-in; titles are encrypted;
disable is unavailable on Cloud; server-managed at-rest encryption (Phase 1.5) is
dropped; and wraps hold `DEK || tag_key`. Implementation sub-issues follow from the
recommendation at the end as amended.

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
`updated_at`, never the payload.

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

- `apps/site/src/content/docs/cloud/encryption.md`: server-managed and optional E2E modes
- `docker/.env.example`: commented `ENCRYPTION_SECRET=` ("Phase 1.5+")
- `crates/storage/src/lib.rs`: `StorageConfig.encrypted: bool` (unused)
- `resume_versions` exists but has no writers; live history is `resume_snapshots`
  (`crates/server/src/db/snapshots.rs`, added after this RFC was written)
- `is_public` / `public_slug` are now served by `update_sharing` (`resume.publish` /
  `resume.unpublish`, added after this RFC was written); `password_hash` still has no API

This RFC grounds decisions in **what is shipped today** and classifies how each
planned feature interacts with E2EE.

## Threat model

### What E2EE protects against

| Threat                                          | Mitigation                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| Postgres or backup compromise                   | Resume payloads are ciphertext; operator cannot read content without the user's secret |
| Curious or malicious operator                   | Same as above for stored data                                                          |
| Cross-tenant data leak via DB query             | Ciphertext is useless without per-user/per-resume keys                                 |
| Passive network observer of stored sync traffic | TLS protects in transit today; E2EE adds at-rest protection after TLS terminates       |

### What E2EE cannot protect against

| Threat                                                     | Why                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Compromised client device or browser extension             | Attacker sees plaintext before encryption / after decryption                             |
| Malicious client JavaScript (XSS, supply-chain compromise) | Attacker can exfiltrate keys and plaintext                                               |
| Server-side features that require plaintext                | User explicitly sends decrypted data for render/export (transient exposure)              |
| WorkOS account takeover                                    | Attacker gains session access; can trigger client-side decrypt if keys are session-bound |
| Lost user secret with no recovery                          | Data is permanently unreadable, by design                                                |

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
   material, or recovery codes. Never the login credential.

2. **Server features assume readable JSON today.**
   - `POST /api/render/pdf` and `POST /api/render/preview` accept client-posted
     `ResumeData` JSON (`crates/server/src/routes/render.rs`). They do not load from
     the database, but the client must send plaintext for server-side Typst rendering.
   - `GET /api/resumes/export` and `GET /api/resumes/export/pdf` read `data` directly
     from Postgres (`crates/server/src/routes/export.rs`).
   - Future public pages (#65) and version history (#91) require server-readable
     snapshots unless redesigned.

3. **WASM cannot render PDFs.** `bindings/wasm` exposes parse, validate, and storage
   only, not `crates/render`. Server-side PDF generation stays on native Typst unless
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
   encrypt individual updates or CRDT state, not whole-document blobs that defeat
   merge semantics. This RFC specifies document-level encryption; a CRDT-specific
   envelope variant is an open follow-up.

## Options

### Key management schemes

| Option                            | Description                                                                                                                                                                                  | Pros                                                               | Cons                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **A. Passphrase-on-top**          | User sets an encryption passphrase independent of WorkOS login. Argon2id derives a master key (MK).                                                                                          | Simple mental model; works with SSO; no server key storage         | Forgotten passphrase = data loss unless recovery codes exist; passphrase entry friction on every device                          |
| **B. Device-held key + wrapping** | Each device generates a random Data Encryption Key (DEK). DEK is wrapped by MK derived from passphrase, or by a device-specific key stored in secure enclave / IndexedDB non-exportable key. | Better UX after initial unlock; supports "remember on this device" | Key sync across devices requires wrapping key export or recovery flow; more implementation complexity                            |
| **C. Recovery codes**             | On E2EE enable, server stores `hash(code)` plus encrypted DEK backups wrapped by each code.                                                                                                  | Mitigates passphrase loss                                          | Recovery codes are secrets users must store; server-held wrapped DEK backups are weaker than pure E2EE but required for recovery |
| **D. WorkOS-bound wrapping**      | Derive wrapping key from WorkOS session or OIDC token.                                                                                                                                       | No extra passphrase                                                | **Rejected:** session tokens rotate and are server-visible; provides no meaningful E2EE                                          |

**Recommendation:** a hybrid of options A and B. A passphrase-derived MK wraps a per-account DEK;
each device holds an unwrapped DEK in session memory (cleared on logout). Option C as
mandatory recovery flow when enabling E2EE.

### Scope: what is encrypted

| Data                                                   | Plaintext or ciphertext                                                   | Rationale                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `resumes.data`                                         | **Ciphertext envelope** (when E2EE enabled)                               | Core PII, the full resume document                                                                                    |
| `resumes.title`                                        | **Plaintext** in v1 as written; **encrypted** under RFC 0003 from Phase 2 | Required for list UI (`GET /api/resumes` returns title only) until the list comes from the local store                |
| `resumes.id`, timestamps, `version`                    | **Plaintext**                                                             | Metadata and OCC                                                                                                      |
| `resumes.is_public`, `public_slug`                     | **Plaintext flags**                                                       | Routing metadata; public content itself cannot be E2EE                                                                |
| `resume_snapshots.data`                                | **Same envelope as parent**                                               | History snapshots must match parent encryption mode (`resume_versions` is unused; live history is `resume_snapshots`) |
| Local IndexedDB (`apps/web/src/stores/persistence.ts`) | **User choice**                                                           | Local-only users unaffected; cloud users decrypt on load                                                              |

### Opt-in vs default

| Approach               | Recommendation                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Opt-in per account** | Recommended in v1 as written; **overridden by RFC 0003, which makes encryption default-on** for every relay-backed account.                   |
| **Opt-in per resume**  | Possible future extension; adds UI and conflict complexity when mixing modes. Defer to v2.                                                    |
| **Default-on E2EE**    | **Rejected for v1.** Breaks server export, bulk PDF, and future public pages without explicit user consent and feature degradation messaging. |

## Crypto envelope specification

All E2EE resume payloads use a **versioned JSON envelope** stored in `resumes.data`
(reusing the existing JSONB column, so no column-type migration is needed).

### Envelope format (v1)

```json
{
  "e2ee": {
    "version": 1,
    "generation": 1,
    "nonce": "<base64url, 12 bytes>",
    "ciphertext": "<base64url, ChaCha20-Poly1305 encrypted ResumeData JSON>"
  }
}
```

| Field               | Specification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **KDF**             | Argon2id (RFC 9106). Default params: `m=19456` KiB, `t=2`, `p=1`. Params and salt live in `users.e2ee_config` (account-level), not per-resume.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Key derivation**  | `MK = Argon2id(passphrase, salt, params)` → 32 bytes. Account `DEK` is a random 32-byte value generated at E2EE enable and wrapped by MK (not derived from MK). Under RFC 0003 a second random 32-byte `tag_key` is generated at enable and every MK and RK wrap holds the 64-byte `DEK \|\| tag_key`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **AEAD**            | ChaCha20-Poly1305 (RFC 8439). Key = account DEK. Nonce = 12 random bytes per encryption; **must never repeat** for a given DEK. This rule covers DEK-keyed resume envelopes and MK-keyed DEK wraps only. RK-keyed recovery backups have a separate nonce-freshness requirement below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Plaintext input** | Canonical JSON serialization of `ResumeData` (same as today).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Detection**       | Payload is an E2EE envelope only when the top-level object contains **only** an `e2ee` key (no `basics`, `sections`, or `metadata`). Server rejects mixed plaintext+ciphertext shapes and malformed envelopes (`e2ee.version`, `e2ee.generation`, `e2ee.nonce`, `e2ee.ciphertext` required) with 422. `e2ee.generation` must equal the account's current `e2ee_config.key_generation`, with one exception during DEK rotation: while `rotation_in_progress` is set and `rotation_verified` is not, both `key_generation` and `key_generation + 1` are accepted; once `rotation_verified` is set (the step 2 verify transaction) only `key_generation + 1` is accepted until step 5 increments the counter. Any other value is 422. The field is client-supplied metadata beside the ciphertext, so this is a guard against honest clients and stale tabs writing under a retired DEK, not a proof of which key sealed the bytes. Valid envelopes skip resume-schema checks and the per-field string-length cap (`MAX_STRING_FIELD_LEN`), since the ciphertext is one long base64url string; `MAX_RESUME_JSON_BYTES` and the depth limit still apply. |

### Per-account DEK wrapping (unlock flow)

1. On E2EE enable: generate random 32-byte DEK (and, under RFC 0003, a random
   32-byte `tag_key`; the wrapped plaintext below is then `DEK || tag_key`).
2. Derive MK from user passphrase via Argon2id.
3. Wrap the keys: `wrapped_dek = ChaCha20-Poly1305(MK, nonce_wrap, DEK || tag_key)`
   (`DEK` alone as originally written).
4. Store the wrap as `{ "nonce": "<base64url nonce_wrap>", "ciphertext": "<base64url>" }`
   together with the KDF salt and params in a new `users.e2ee_config JSONB` column,
   the same shape recovery backups use (server stores the wrapped key only and cannot
   unwrap it without the passphrase).
5. On unlock: client fetches `e2ee_config`, derives MK, unwraps DEK, holds DEK in memory.

### Recovery codes

On enable, the client generates one-time recovery codes. Each code is 128 bits from
a CSPRNG, shown as 26 characters of Crockford base32 in groups for readability; 128
bits is what makes an unsalted SHA-256 lookup and an HKDF-derived RK safe against an
operator holding the hash rows. Eight codes are issued per account. For each code:

1. Derive `RK = HKDF-SHA256(code, info="rustume-recovery-v1")` → 32 bytes.
2. Sample a fresh 12-byte nonce (`nonce_recovery`). Encrypt the key backup (the DEK as
   written here; `DEK || tag_key` under RFC 0003):
   `wrapped_dek_recovery = ChaCha20-Poly1305(RK, nonce_recovery, DEK || tag_key)`
   (`DEK` alone as originally written).
3. Upload the recovery backup blob to the server. Each recovery code is stored as one
   row (or JSON object) that **atomically associates**:
   - `code_hash` = `SHA-256(code)` (lookup / verification key)
   - `backup` = `{ "nonce": "<base64url>", "ciphertext": "<base64url>" }` (the
     `nonce_recovery` + ciphertext pair for that same code)
   The server must never store a ciphertext without its nonce, and must never return a
   backup blob that is not the one paired with the matched `code_hash` (operator still
   cannot decrypt without the code).
4. On recovery: the client computes `SHA-256(code)` locally and sends only that
   hash, never the raw code or RK → server finds the row where `code_hash` matches →
   returns that row's `backup` blob → client derives RK, unwraps DEK with the stored
   nonce, prompts new passphrase.

**Nonce freshness (RK-keyed):** each recovery backup is keyed by `RK`, not the account
DEK. The DEK-envelope nonce rule above does **not** cover these blobs. Reusing
`nonce_recovery` under the same `RK` (for example when re-encrypting a new DEK for the
same recovery code during DEK rotation) is catastrophic for Poly1305. Therefore:

- the recovery backup format must persist its nonce alongside the ciphertext; and
- every rewrite of a recovery backup, including DEK rotation step 4 below, **must**
  sample a fresh `nonce_recovery`.

### Where the code lives

| Component                      | Location                                                                                           | Rationale                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Envelope serialize/deserialize | New `crates/crypto`                                                                                | Keeps `crates/schema` free of crypto deps; shared by server (validation/detection) and clients |
| KDF + AEAD primitives          | `crates/crypto` via `argon2`, `chacha20poly1305`, `hkdf` crates                                    | Audited Rust crypto libraries                                                                  |
| WASM bindings                  | `bindings/wasm`: `encrypt_resume`, `decrypt_resume`, `derive_master_key`, `wrap_dek`, `unwrap_dek` | Web client must encrypt before upload                                                          |
| Server routes                  | `crates/server`: detect envelope, skip plaintext validation, never decrypt                         | Server remains zero-knowledge for stored data                                                  |
| Future mobile                  | Same `crates/crypto` via FFI                                                                       | Consistent envelope across platforms                                                           |

`crates/render` and `crates/server/src/routes/render.rs` remain unchanged. They
continue to accept plaintext JSON from the client.

## Feature compatibility matrix

Classification: **Keep** (works with E2EE), **Degrade** (works with client-side
decrypt + explicit plaintext handoff), **Exclude** (incompatible when E2EE enabled).

| Feature                           | Issue | Current behavior                                                                                                         | E2EE enabled                                                                 | Notes                                                                                                                                   |
| --------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Resume CRUD + list                | n/a   | Plaintext `data` in Postgres                                                                                             | **Keep**                                                                     | Ciphertext stored instead; title stays plaintext                                                                                        |
| Optimistic concurrency            | n/a   | `version` column, 409 on mismatch                                                                                        | **Keep**                                                                     | Unaffected; version is metadata                                                                                                         |
| Server PDF render (single)        | n/a   | Client posts plaintext to `POST /api/render/pdf`                                                                         | **Degrade**                                                                  | Client decrypts locally, posts plaintext per request. Transient server memory exposure.                                                 |
| Server PDF preview                | n/a   | Same as render                                                                                                           | **Degrade**                                                                  | Same transient exposure                                                                                                                 |
| Bulk JSON export                  | #353  | Server reads plaintext from DB                                                                                           | **Degrade**                                                                  | Client-side export: fetch envelopes, decrypt, assemble JSON bundle locally                                                              |
| Bulk PDF export (ZIP)             | #353  | Server reads DB + Typst render                                                                                           | **Degrade**                                                                  | Client decrypts each resume, POSTs to render, or future client-side PDF                                                                 |
| Public resume pages               | #65   | Sharing write exists via `update_sharing` (`resume.publish` / `resume.unpublish`); public GET/HTML serving still missing | **Exclude** (v1); RFC 0003 replaces this with an explicit published snapshot | Public pages require server-readable HTML/OG metadata. Block publish when E2EE on.                                                      |
| Version history                   | #91   | `resume_snapshots` has writers and list/restore routes                                                                   | **Degrade**                                                                  | Store encrypted snapshots in `resume_snapshots.data`. Server-side diff/preview requires client decrypt. No server-side restore preview. |
| Operator backups (`pg_dump`)      | #334  | Full DB dump includes plaintext                                                                                          | **Keep**                                                                     | Ciphertext backs up fine. Restore verification requires client decrypt smoke test, not server readability check.                        |
| Account export (GDPR)             | #353  | Bulk export routes                                                                                                       | **Degrade**                                                                  | Export includes ciphertext envelopes + `e2ee_config`. User decrypts with passphrase.                                                    |
| Local↔cloud import                | #338  | `POST /api/resumes/import` upserts by id                                                                                 | **Keep**                                                                     | Client encrypts before import; server rejects non-envelope `data` when `e2ee_enabled`. Document id-preserving flow in linking RFC.      |
| Local IndexedDB storage           | n/a   | WASM storage, no encryption                                                                                              | **Keep**                                                                     | Independent of cloud E2EE as written; under RFC 0003 the browser store holds envelopes and is the authoritative local copy              |
| Server-managed at-rest encryption | n/a   | Documented, not implemented (`ENCRYPTION_SECRET`)                                                                        | ~~**Orthogonal**~~ dropped by RFC 0003                                       | Redundant once every stored document is an envelope                                                                                     |
| CRDT sync                         | #40   | Not implemented                                                                                                          | **Degrade**                                                                  | Document-level envelope is interim; CRDT adoption needs update-level encryption                                                         |
| Search / indexing                 | n/a   | Not implemented                                                                                                          | **Exclude** server-side; client-side under RFC 0003                          | Full-text search on encrypted payloads is impossible server-side; RFC 0003 searches the decrypted local library                         |

## Recommendation

**Adopt account-level E2EE with a passphrase + recovery codes (opt-in as written here,
default-on under RFC 0003), storing
versioned ChaCha20-Poly1305 envelopes in the existing `resumes.data` JSONB column.**

### Decision log

| Decision                  | Choice                                                                      | Rationale                                                                           |
| ------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| E2EE default              | Opt-in as written; **default-on under RFC 0003**                            | Feature parity was the v1 reason; RFC 0003 moves those features client-side instead |
| Key derivation            | Passphrase + Argon2id (not WorkOS password)                                 | WorkOS provides no password; SSO and E2EE secrets must be independent               |
| DEK model                 | Per-account DEK wrapped by passphrase-derived MK                            | Enables single unlock to encrypt/decrypt all resumes; simplifies key rotation       |
| Storage                   | Envelope in existing `data` column                                          | Avoids schema migration for column type; detection via `"e2ee"` wrapper             |
| Code location             | New `crates/crypto` + WASM bindings                                         | Shared across web and future mobile; keeps schema crate pure                        |
| Public pages              | Excluded when E2EE on; superseded by RFC 0003's explicit published snapshot | Cannot serve readable HTML from ciphertext without defeating E2EE purpose           |
| Server render/export      | Degraded (client decrypt → transient plaintext)                             | Acceptable trade-off for opt-in users; document transient exposure                  |
| Server-managed encryption | ~~Proceed separately (Phase 1.5)~~ dropped by RFC 0003                      | Redundant once every stored document is an envelope                                 |

### Decision triggers

| Trigger                                    | Action                                                                                                                                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User enables E2EE in Account settings      | Generate DEK, prompt passphrase + recovery codes, re-encrypt all resumes and snapshot history                                                                                                                                               |
| User forgets passphrase, has recovery code | Unwrap DEK via recovery flow, prompt new passphrase                                                                                                                                                                                         |
| User forgets passphrase, no recovery       | Data permanently lost. Display a clear warning at enable time                                                                                                                                                                               |
| User requests public page on E2EE resume   | Block with explanation; the only alternatives are account-wide disable (self-hosted only once RFC 0003 applies) or an explicit published snapshot per RFC 0003. No per-resume plaintext duplicate, which would mix modes within an account. |
| CRDT (#40) accepted                        | File follow-up RFC for update-level envelope                                                                                                                                                                                                |
| Mobile app ships                           | Reuse `crates/crypto` via FFI; same envelope                                                                                                                                                                                                |

## Migration and rotation

### Enabling E2EE (plaintext → ciphertext)

1. Client verifies passphrase strength and displays recovery codes (user confirms saved).
2. Client generates DEK (and, under RFC 0003, `tag_key`), wraps `DEK || tag_key` with
   MK, uploads `e2ee_config` and recovery backups to server.
3. Client fetches all resumes and all `resume_snapshots` rows (plaintext), encrypts
   each to a v1 envelope, and writes them back.
4. Server atomically verifies every resume row **and** every snapshot row for the
   account is a valid envelope, then commits `e2ee_enabled = true` in one
   transaction. During this step, resume and snapshot writes for the account are
   rejected unless the payload is a valid envelope (blocks TOCTOU from concurrent
   tabs or older clients).
5. Audit event recorded (`crates/server/src/audit/`).

All steps are client-driven; server never sees passphrase or unwrapped DEK.

### Disabling E2EE (ciphertext → plaintext)

Under RFC 0003 this flow is unavailable on Rustume Cloud and exists only on a
self-hosted relay with `RUSTUME_ALLOW_PLAINTEXT=true`.

1. User provides passphrase (or recovery code).
2. Client decrypts all resumes and all `resume_snapshots` rows, writes plaintext JSON.
3. Server atomically verifies every resume row and every snapshot row is plaintext
   JSON and clears `e2ee_config` / sets `e2ee_enabled = false` in one transaction
   (reject toggle if any row is still an envelope or a write failed). During this
   step, resume and snapshot writes must be plaintext.

Requires explicit user action. The operator cannot reverse it alone.

### Passphrase rotation

1. User provides old passphrase.
2. Client unwraps DEK with old MK.
3. User provides new passphrase.
4. Client re-wraps same DEK with new MK, updates `e2ee_config`.
5. Resume envelopes unchanged (DEK unchanged), so no re-encryption of all resumes.

### DEK rotation (compromise recovery)

1. Client generates the new DEK, wraps it with the current MK as a **second** wrap
   stored beside the old one in `e2ee_config` (`wrapped_dek_next`), and writes a **second**
   recovery backup per code (`backup_next`, its own fresh nonce, the 64-byte
   `DEK_next || tag_key`) beside the existing one, so both generations stay
   recoverable without changing the blob format. Setting
   `e2ee_config.rotation_in_progress = true` is part of the same server write, and the
   server accepts generation N and N+1 from here until step 2's verify passes. Nothing has
   been re-encrypted yet,
   so a crash at this point loses nothing: both keys are recoverable.
2. Re-encrypt every resume envelope and every `resume_snapshots` row for the account
   with the new DEK, each with a fresh nonce. A crash mid-way is safe because both
   wraps exist; the client resumes by scanning for rows still at generation N.
   Rotation must not complete while any row is still under the old DEK. The relay
   cannot decrypt, so its atomic check is that every resume and snapshot row carries
   `e2ee.generation = N+1`, an honest-client guard as the Detection row says; the
   real proof is on the client, which decrypts each rewritten row with `DEK_next`
   before requesting the flip and refuses to proceed on any failure. Once both hold,
   the server, in the same transaction as its check, sets
   `e2ee_config.rotation_verified = true`, which stops accepting
   generation N. From here only N+1 envelopes are stored,
   so nothing written after this point can depend on the old wrap.
3. Promote `wrapped_dek_next` to `wrapped_dek` and drop the old wrap in `e2ee_config`.
4. Promote each code's `backup_next` to `backup` and delete the old blob, with a
   **fresh** `nonce_recovery` if the blob is rewritten, so each code holds only the
   new generation (step 1 wrote the second blob) and every stored recovery
   blob unwraps the new DEK (never reuse a prior recovery nonce under
   the same `RK`), **or** invalidate and regenerate recovery codes before completing
   rotation. When keeping the same codes, each `code_hash` row's `backup` **must be
   replaced atomically** (single-row upsert / delete-then-insert in one transaction) so
   lookup never observes both an old and a new backup for the same hash. Invalidation
   **must** delete (or mark unusable and refuse to return) every prior `code_hash` +
   `backup` row for the account in the same transaction that writes the new recovery
   set / new DEK wrap. Old codes must be unreachable before rotation is considered
   complete. Leaving old rows active while adding new ones is forbidden: an old or
   stale backup must not unwrap the previous DEK after resumes have moved to the new
   DEK.
5. Increment `e2ee_config.key_generation` and clear both `rotation_in_progress` and
   `rotation_verified`. To restate the single rule the Detection row enforces: both
   generations are accepted only from step 1 until the step 2 verify; from the verify
   to step 5 only N+1 is accepted; after step 5 only the new current generation is.

### Existing plaintext rows

As written, no forced migration: plaintext and E2EE accounts coexist. RFC 0003
overrides this with a deadline-driven migration of existing accounts. Individual resume rows on
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

5. **Envelope in `resume_snapshots`.** Resolved: the same v1 envelope as the parent
   resume, with a fresh 12-byte nonce per encryption and no separate history nonce
   map. The scope table, enable flow, and DEK rotation already require this.

6. **Subscription / billing interaction.** Does E2EE affect plan limits (storage size
   of ciphertext ≈ plaintext + overhead)?

## Spawned issues

If this RFC is accepted, file the following implementation sub-issues:

| #   | Title                                                             | Scope                                                                                                                                                 |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `feat(crypto): add crates/crypto with v1 envelope`                | Argon2id, ChaCha20-Poly1305, HKDF, envelope serialize/deserialize, tests with test vectors                                                            |
| 2   | `feat(wasm): expose encrypt/decrypt bindings`                     | `bindings/wasm` wrappers for web client                                                                                                               |
| 3   | `feat(server): E2EE account config column and detection`          | `users.e2ee_config`, strict envelope detection/rejection in validation middleware, reject non-envelope resume and snapshot writes when `e2ee_enabled` |
| 4   | `feat(web): E2EE enable and unlock UI`                            | Account settings, passphrase entry, recovery code display, DEK session management. Disable is self-hosted only under RFC 0003                         |
| 5   | `feat(web): encrypt on cloud save, decrypt on load`               | `cloudStorage.ts` integration with WASM crypto; enable/disable flows convert `resume_snapshots` rows as well as resumes                               |
| 6   | `feat(web): client-side bulk export for E2EE accounts`            | Replace server-side JSON/PDF export when `e2ee_enabled`                                                                                               |
| 7   | `feat(server): explicit published snapshot for public pages`      | Replaces the original publish block: publishing uploads a readable snapshot per RFC 0003; private envelopes are never served                          |
| 8   | `docs: update encryption.md to match RFC 0001`                    | Align user-facing docs with decided design                                                                                                            |
| 9   | ~~`feat(server): server-managed at-rest encryption (Phase 1.5)`~~ | Dropped by RFC 0003; redundant once every stored document is an envelope                                                                              |
| 10  | `feat(server): version history with E2EE snapshots`               | Make the existing `resume_snapshots` writers and restore routes envelope-aware; do not add writers to the unused `resume_versions` table              |

---

*This RFC replaces the implementation sketch in [#44](https://github.com/lgtm-hq/Rustume/issues/44)
for design purposes. Implementation tracking continues in
[#44](https://github.com/lgtm-hq/Rustume/issues/44)
and the spawned sub-issues above.*
