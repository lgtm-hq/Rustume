# RFC 0003: Local-First Encrypted Storage

| Field              | Value                                                                           |
| ------------------ | ------------------------------------------------------------------------------- |
| **Title**          | Local-First Encrypted Storage                                                   |
| **Status**         | Draft                                                                           |
| **Author(s)**      | Rustume maintainers                                                             |
| **Date**           | 2026-09-05                                                                      |
| **Tracking issue** | [#254](https://github.com/lgtm-hq/Rustume/issues/254)                           |
| **Amends**         | [RFC 0001](./0001-e2e-encryption.md), [RFC 0002](./0002-local-cloud-linking.md) |

## Summary

Rustume becomes a **local-first** application. Every client holds the user's
resumes in a local store and is the place where plaintext exists. Servers, whether
Rustume Cloud or a self-hosted instance, are **sync relays**: they authenticate,
store sealed envelopes, and hand them back. They never hold a key and never need
plaintext to do their job.

This settles the storage question for four deployment shapes with one codebase:

| Shape             | Local store      | Relay                                             | Identity                                                        |
| ----------------- | ---------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| Browser-only      | IndexedDB (WASM) | none (static build, or hosted app before sign-in) | none                                                            |
| Rustume Cloud     | IndexedDB (WASM) | Postgres, operated by Rustume                     | WorkOS email sign-in                                            |
| Self-hosted relay | IndexedDB (WASM) | SQLite on a volume, your box                      | implicit local user + access token, required except on loopback |
| Desktop / mobile  | SQLite (native)  | any of the above                                  | as the relay requires                                           |

**Decisions at a glance:**

| Topic            | Decision                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| Source of truth  | The client's local store. Servers are replicas of ciphertext.                                                  |
| Encryption       | **On by default** for every relay-backed account. Envelope per RFC 0001. Amends RFC 0001's opt-in.             |
| Owner access     | **None.** No escrow, no recovery by the operator. Lost passphrase and recovery codes means lost data.          |
| Server data      | Identity, plan, billing, audit, wrapped keys, envelopes, versions, published snapshots. Nothing else.          |
| Storage engines  | Postgres for Cloud, SQLite for self-hosted and native apps, IndexedDB in the browser. One repository trait.    |
| Sync protocol    | RFC 0002's `/api/sync/*` with LWW + manual resolution, applied to **every** client, not only linked instances. |
| Rendering        | Client-side by default once #682 lands. Server render stays for publishing and as an explicit fallback.        |
| Public pages     | Explicit publish uploads a separate readable snapshot. The private document stays sealed.                      |
| Search           | Client-side over the locally decrypted library. No server search.                                              |
| Minimal identity | Email and an opaque WorkOS id. No legal names. Username optional.                                              |

## Context

### What ships today

- Cloud persists plaintext `ResumeData` JSON in Postgres (`resumes.data`,
  `resume_snapshots.data`). The browser talks to it through direct CRUD in
  `apps/web/src/stores/cloudStorage.ts` with optimistic concurrency on `version`.
- Self-hosted mode is browser-only. `docker compose up` runs a stateless server;
  Postgres sits behind the `cloud` compose profile. Clearing site data loses everything.
- Preview and PDF post the full plaintext resume to `/api/render/*` on every keystroke
  (#633). The README privacy claim was scoped per deployment mode because of this.
- `crates/storage` has an IndexedDB backend through `bindings/wasm` and a reserved,
  unimplemented SQLite backend. Its trait (list, get, save, delete, exists) is unused
  by the web app beyond the WASM storage class.
- RFC 0001 designed opt-in E2EE with a passphrase-wrapped account key and recovery
  codes. RFC 0002 designed pairing and LWW sync between a local instance and Cloud.
  Neither is implemented.
- PR #487 implemented #254 as always-on Postgres with server-held AES keys for
  self-hosted mode. It is closed by this RFC.

### Why revisit

The product promise is privacy-first and offline-first, with Cloud as an optional
product offering the **same** privacy standard. Three shipped or planned designs
contradict that promise:

1. **Server-readable resumes.** Opt-in E2EE means the default cloud user's documents
   are readable by the operator, a subpoena, or a breach.
2. **Server-held encryption keys.** #487's at-rest encryption keeps the key next to
   the data. It protects a stolen volume and nothing else, while adding a single point
   of data loss.
3. **Server-centric client.** The browser is a thin client over CRUD. Offline editing,
   multi-device sync, and desktop or mobile apps each need a local store and a sync
   engine that do not exist.

Fixing these one at a time produces three incompatible answers. Fixing them together
produces one. The client owns the data, and servers relay ciphertext.

## Goals and non-goals

### Goals

- A cloud-only user gets offline editing, multi-device sync, and zero operator access
  to their content, without knowing what self-hosting is.
- A self-hoster gets server-side persistence with one container and one file to back
  up, using the same client and relay code as Cloud.
- Desktop and mobile apps reuse the storage, crypto, and sync crates unchanged.
- Linking a self-hosted relay to Cloud is the same mechanism as adding a device.

### Non-goals

- Collaborative editing or CRDT merge (#40 stays deferred).
- Multi-user self-hosting. v1 relays are single-user.
- Searchable encryption. Search is local.
- Removing the server renderer. #633's decision stands.

## Architecture

```text
┌──────────────────────────── client (browser / desktop / mobile) ────────────────────────────┐
│                                                                                              │
│   editor ── plaintext ResumeData in memory ──► crates/render (WASM or native) ──► PDF/preview │
│      │                                                                                       │
│      ▼ encrypt (crates/crypto, account DEK in memory)                                        │
│   local store: envelopes + metadata           search index (decrypted, local only)           │
│   (IndexedDB via crates/storage, or SQLite)                                                  │
│      │                                                                                       │
│      ▼ sync engine (push on save, pull on interval / reconnect)                              │
└──────┼───────────────────────────────────────────────────────────────────────────────────────┘
       │ HTTPS, ciphertext envelopes + version metadata only
       ▼
┌──────────────────────────── relay (Rustume Cloud or self-hosted) ───────────────────────────┐
│   identity (WorkOS | local user)   plan / billing / audit   wrapped keys + recovery blobs    │
│   documents: id, owner, envelope, version, content_tag, updated_at                          │
│   snapshots: encrypted envelopes written by the client                                      │
│   published: explicit readable snapshots for /r/{slug}                                      │
│   storage: Postgres (Cloud) | SQLite (self-hosted)  behind one repository trait              │
│   never holds a DEK, never decrypts, never renders private documents                         │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### The client is the source of truth

Every edit is saved to the local store first, encrypted, and then pushed. The app is
fully usable with the relay unreachable. This is what today's autosave already feels
like to the user; the difference is where the durable copy lives.

### The relay is a dumb, authenticated blob store

A relay's document API is the sync protocol from RFC 0002, generalised:

| Method   | Path                                      | Purpose                                                                                                                    |
| -------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/sync/changes?since=`                | Delta of document ids, versions, content tags, deletions                                                                   |
| `GET`    | `/api/sync/docs/{id}`                     | Fetch one envelope with version metadata                                                                                   |
| `PUT`    | `/api/sync/docs/{id}`                     | Push an envelope; `If-Match: version` for conflict detection                                                               |
| `POST`   | `/api/sync/reconcile`                     | Batched first sync (idempotent)                                                                                            |
| `DELETE` | `/api/sync/docs/{id}`                     | Write a versioned tombstone; `If-Match: version` required                                                                  |
| `GET`    | `/api/sync/docs/{id}/snapshots`           | List snapshot versions for one document                                                                                    |
| `GET`    | `/api/sync/docs/{id}/snapshots/{version}` | Fetch one encrypted history snapshot                                                                                       |
| `PUT`    | `/api/sync/docs/{id}/snapshots/{version}` | Client-written encrypted history snapshot; insert-only, 409 on an existing version unless the ciphertext is byte-identical |

Today's `/api/resumes` CRUD stays during migration and is retired once every client
speaks sync. The relay validates envelope shape and byte limits, never content.

#### Deletions are versioned tombstones

A delete never removes the row. It replaces the envelope with a tombstone carrying
the next version number, and the changes feed returns tombstones like any other
change. The rules that make deletes safe across offline devices:

- `DELETE` requires `If-Match` with the version the client last saw. A stale
  version gets 409, the same as a stale `PUT`.
- A `PUT` against a tombstoned id must carry `If-Match` equal to the tombstone
  version. That is an explicit undelete and bumps the version again. A `PUT` with
  an older version, or with no `If-Match`, gets 409, so a device that was offline
  during the delete cannot resurrect the document by pushing its old envelope.
- Reconcile treats "id exists locally, tombstone exists on the relay" as a
  conflict for the user (keep deleted, or restore from local), never as a silent
  create. This replaces RFC 0002's "local-only id creates a cloud row" rule when a
  tombstone is present.
- Tombstones are retained for at least 90 days, and until every non-expired cursor
  on the account has pulled past their version. A client is any browser session,
  relay, or native app that has completed a pull; there is no separate device
  registry. A cursor expires after 90 days without a pull, so an abandoned tab
  cannot hold tombstones forever. Once both conditions hold the relay may
  garbage-collect them.
- A client whose cursor has expired must run a full reconcile, not a delta pull. In a full reconcile, a local document that has a
  relay version recorded (it was synced before) but no row on the relay is treated
  as deleted on the relay, and surfaces the same keep-deleted-or-restore choice as
  a live tombstone. Only a local document that has never been synced is created.
  This is what keeps the no-resurrection rule true after garbage collection.

### One repository trait, three engines

`crates/storage` is promoted from a thin key-value trait to the repository the relay
and the native clients share:

```rust
#[async_trait]
pub trait DocumentRepo {
    async fn list_changes(&self, owner: OwnerId, since: Cursor) -> Result<Changes>;
    async fn get(&self, owner: OwnerId, id: DocId) -> Result<Option<StoredDoc>>;
    async fn put(&self, owner: OwnerId, doc: StoredDoc, expected: Option<Version>) -> Result<PutOutcome>;
    /// Writes a tombstone at `expected + 1`; the row is retained, not removed.
    async fn delete(&self, owner: OwnerId, id: DocId, expected: Version) -> Result<Tombstone>;
    /// Insert-only. An existing `(id, version)` is an error unless the stored
    /// ciphertext is byte-identical, which makes retries idempotent.
    async fn put_snapshot(&self, owner: OwnerId, snap: StoredSnapshot) -> Result<()>;
    async fn list_snapshots(&self, owner: OwnerId, id: DocId) -> Result<Vec<SnapshotMeta>>;
    async fn get_snapshot(&self, owner: OwnerId, id: DocId, version: Version) -> Result<Option<StoredSnapshot>>;
}
```

`StoredDoc` is either an envelope with metadata or a tombstone; `Changes` carries
both. `DocumentRepo` is a new trait, not a rename of today's `StorageBackend`. The
existing `StorageBackend` (plaintext `list`, `get`, `save`, `delete`, `exists`) stays
in `crates/storage` and behind `bindings/wasm` until Phase 2 replaces
`apps/web/src/stores/persistence.ts` with the sync engine, at which point it is
deleted. Nothing adapts one to the other; the two callers are migrated one after the
other.

| Engine    | Used by                            | Notes                                                               |
| --------- | ---------------------------------- | ------------------------------------------------------------------- |
| Postgres  | Rustume Cloud relay                | Existing schema, `data` column holds envelopes                      |
| SQLite    | Self-hosted relay, desktop, mobile | Single file on `/data`; UUID and timestamps stored as TEXT          |
| IndexedDB | Browser client                     | Existing WASM backend, extended with version metadata and snapshots |

Only document tables live behind the trait. Users, sessions, policy acceptances,
subscriptions, and audit are cloud concerns and stay in the server crate on Postgres.
Of the server's roughly 47 query sites, the 27 in `routes/resumes.rs` and
`db/snapshots.rs` move behind the trait; the rest are untouched.

## Encryption

RFC 0001's envelope, key hierarchy, recovery codes, and rotation procedures are
adopted unchanged. This RFC amends three decisions.

### Default-on

Every relay-backed account seals documents from its first save. There is no plaintext
cloud account. RFC 0001 chose opt-in to preserve server-side export, bulk PDF, and
public pages; this RFC moves those features client-side or behind explicit publish
instead of weakening the default.

| Shape             | Encryption                                                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rustume Cloud     | Mandatory. Passphrase and recovery codes set at first cloud use.                                                                                                                             |
| Self-hosted relay | On by default. Operator may set `RUSTUME_ALLOW_PLAINTEXT=true` to permit plaintext envelopes; the relay logs a warning at startup. Existing envelope detection distinguishes the two shapes. |
| Browser-only      | Optional app lock. No relay exists to protect against; forcing a passphrase here adds loss risk without benefit.                                                                             |

### No owner access, stated as policy

The operator of Rustume Cloud cannot read, recover, or reset the content of any
account. There is no escrow key and no support-side recovery. A user who loses both
passphrase and every recovery code has lost their documents, and the only remedy is
an account reset. This is documented in the support policy and the privacy page, and
stated in the app at passphrase setup.

The operator can still see and act on email, plan, billing state, sign-in and audit
events, document counts and sizes, timestamps, and any snapshot the user explicitly
published.

### Titles are encrypted

RFC 0001 kept `resumes.title` plaintext so the list could render before unlock. In a
local-first client the list renders from the local store, which is decrypted after
unlock anyway. Titles move inside the envelope. The relay's document row carries no
human-readable field.

### Content tags, not content hashes

RFC 0002 computed `content_hash = SHA-256(plaintext)` for conflict detection. A
plaintext hash on the server lets anyone holding the database confirm a guessed
document and detect identical documents across accounts. Replace it with
`content_tag = HMAC-SHA256(tag_key, canonical bytes)`, where the canonical bytes are
the UTF-8 compact JSON with sorted object keys that RFC 0002 already defines, so
every client produces the same tag for the same document.

`tag_key` is a second random 32-byte account key generated at enable. It is wrapped
and recovered together with the DEK: the MK-wrapped blob in `users.e2ee_config` and
each RK-wrapped recovery backup from RFC 0001 hold the 64-byte concatenation
`DEK || tag_key` instead of the DEK alone, so unlocking or recovering an account
always yields both keys. Passphrase rotation re-wraps both; DEK rotation replaces the
first 32 bytes only and re-wraps under the same rules. `tag_key` is deliberately not
derived from the DEK: RFC 0001's DEK rotation re-encrypts every envelope, and a
tag key tied to the DEK would change every tag at once and make unchanged documents
look edited on every device. Rotating `tag_key` is a separate, rare operation that
re-tags all documents and resets sync cursors in one step.

What the relay learns from a deterministic tag: whether two envelopes in the same
account hold identical plaintext, and whether a document changed between pushes. It
cannot confirm a guessed plaintext without `tag_key`, and it cannot compare across
accounts. That equality leak is accepted; it is the information sync needs anyway.

### Key lifetime on a device

The unwrapped keys live in memory for the session. "Remember this device" wraps the
same 64-byte `DEK || tag_key` blob with a non-exportable WebCrypto key held in
IndexedDB, so the passphrase is needed once per device rather than once per visit
and a returning session can both decrypt and tag. Sign-out clears the blob and the
in-memory keys. Passkeys
with the WebAuthn PRF extension are the intended replacement for the passphrase and
are tracked as an open question.

## Sync

RFC 0002's merge model applies. Last-write-wins when only one side changed, manual
resolution when both did (#42 offline queue, #43 conflict UI, #645 status indicator).
What changes is scope. RFC 0002 described sync between a *local instance* and Cloud.
Here **every client is a sync client**, including a cloud user's browser tab. The
browser no longer calls resume CRUD; it saves to IndexedDB and lets the sync engine
reconcile.

Cadence is unchanged from RFC 0002: push on the existing autosave debounce, pull on
an interval and on `visibilitychange`, drain the queue on reconnect. The user-facing
addition is a persistent save and sync status (#645), which this design makes
truthful because "saved" and "synced" are now distinct events.

Linking a self-hosted relay to Cloud (RFC 0002's core case) collapses to the relay
running the sync engine against Cloud with the user's device credentials. Pairing,
unlink, and retention semantics from RFC 0002 remain; the "self-hosted sync client"
row in its rollout table is this RFC's Phase 3 relay plus the sync engine.

## Rendering

Server-side rendering is the one place plaintext leaves the client today (#633).
This RFC does not remove the server renderer; #633 recorded why it cannot go
(published pages, crawlers, OG images). It changes the **default path**:

| Path                          | Today                        | Target                                                                 |
| ----------------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| Live preview                  | POST plaintext per keystroke | `crates/render` in WASM, in the browser                                |
| PDF export                    | POST plaintext               | WASM render, download locally; works offline                           |
| Bulk PDF export               | Server reads DB              | Client iterates local library, renders each, zips locally              |
| Published page HTML, OG image | Server render                | Server render of the **published snapshot** only                       |
| Weak device fallback          | n/a                          | Opt-in "render on server" toggle; sends transient plaintext, disclosed |

Client rendering is gated on #682. The unoptimised WASM payload is 17.4 MB gzipped,
almost entirely embedded fonts. #682 must answer font subsetting or on-demand font
loading, lazy loading of the render module, and output equivalence in CI before the
default flips. Until it does, cloud users render through the transient server path
with the disclosure #633 introduced. That is a weaker interim state, not the design.

## Publishing and public pages

A private document is never readable by the relay, so a public page cannot be served
from it. Publishing is an explicit action that creates a **separate readable
snapshot**:

1. User toggles publish in the share modal (#360). The UI states that a readable copy
   will be stored on the server for as long as the page is public.
2. The client decrypts, uploads the plaintext snapshot to `published`, and the server
   assigns the slug. `/r/{slug}`, its OG tags, and its preview PNG (#359) render from
   this row, using the server renderer.
3. Edits to the private document do not change the public page until the user
   republishes. Unpublish deletes the snapshot.

A link-key variant, where the snapshot is encrypted and the key rides in the URL
fragment so the server still cannot read it, is listed as an open question. It
sacrifices OG previews and crawler visibility, which is the point of public pages for
most users, so it is not v1.

## Search, export, and history

| Feature                 | Where it runs                                                                 | Notes                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Search                  | Client, over the decrypted local library                                      | Full content, including titles. Index cached locally, never uploaded.                      |
| JSON export             | Client                                                                        | Decrypt in memory, download.                                                               |
| Bulk PDF export         | Client                                                                        | Depends on client rendering; interim path uses server render per document.                 |
| Account export (#353)   | Server ships metadata + envelopes + wrapped keys; client decrypts on download | Satisfies portability. Completes without operator readability.                             |
| Version history         | Client writes encrypted snapshots to the relay                                | Restore and diff decrypt on the client. Existing `resume_snapshots` table holds envelopes. |
| Import (JSON, LinkedIn) | Client, unchanged                                                             | Parsing already runs in WASM.                                                              |

## Identity and account data

The relay stores the minimum needed to authenticate and bill:

| Field                         | Cloud                        | Self-hosted relay            |
| ----------------------------- | ---------------------------- | ---------------------------- |
| Opaque id                     | WorkOS `user_…`              | fixed local user id          |
| Email                         | from WorkOS, for sign-in     | none                         |
| Username (#337)               | optional, user-chosen        | none                         |
| Legal names                   | **dropped** (#435 direction) | none                         |
| Plan, Paddle customer         | yes                          | none                         |
| `e2ee_config`, recovery blobs | yes                          | yes unless plaintext allowed |

The self-hosted container stores data by default. `docker compose up` starts the
relay with SQLite on the mounted volume and no profile flag. The browser's IndexedDB
copy is authoritative for edits, as everywhere else in this design; the SQLite file
is the durable replica that survives a cleared browser and is the thing to back up.
Browser-only mode is for the static build and the hosted app before sign-in, not for
a container someone chose to run.

Self-hosted relay authentication is an implicit single local user, gated by an
access token. The relay fails closed: if it is bound to a non-loopback address and
no token is configured, it refuses to start with a non-zero exit and a message
naming the variable. Only a loopback bind (`RUSTUME_BIND=127.0.0.1`) may run without
a token. Every sync request must present the token; requests without it get 401.

Because the container binds `0.0.0.0` and compose publishes the port, the default
compose deployment needs a token without asking the user to invent one. The compose
file sets `RUSTUME_ACCESS_TOKEN_FILE=/data/access_token`; on first start the relay
generates a random token there with mode 0600 and logs only the file path, never
the secret; the operator reads it with `docker compose exec rustume cat
/data/access_token`. The web app asks for it on first visit to that origin and keeps
it in local storage. Operators may set `RUSTUME_ACCESS_TOKEN` directly instead.

## Feature compatibility

| Feature                                                      | Impact                                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Resume CRUD, autosave                                        | Same UX. Local write then sync push.                                                                            |
| Multi-device                                                 | New capability for cloud users. Sign in, unlock, sync.                                                          |
| Offline editing and export                                   | New capability. Export needs client rendering.                                                                  |
| Public pages (#65, #359, #360)                               | Work via explicit published snapshot.                                                                           |
| API keys (#361, #85)                                         | Keys reach envelopes and publish endpoints only. A third-party client must hold the user's DEK to read content. |
| Billing (#363)                                               | Unaffected.                                                                                                     |
| GDPR export (#353)                                           | Envelopes plus metadata, client-decrypted.                                                                      |
| Username (#337)                                              | Unaffected, aligned.                                                                                            |
| Server-managed at-rest encryption (RFC 0001 Phase 1.5, #487) | **Dropped.** Redundant when every stored document is already ciphertext.                                        |
| CRDT (#40)                                                   | Still deferred. Per-update envelopes would be a follow-up RFC.                                                  |
| Operator backups (#334)                                      | Simpler. Backups are ciphertext; restore verification is a client smoke test.                                   |

## User journeys

**Cloud-only user, first day.** Sign in with email. Set a passphrase, save recovery
codes, confirm the "we cannot recover this" statement. Start editing. Autosave writes
locally and syncs. Close the laptop; nothing is lost.

**Cloud-only user, second device.** Sign in, enter the passphrase, tick "remember this
device". Sync pulls the library. Search works over everything within seconds.

**Cloud-only user, cleared browser data.** Sign in, enter the passphrase. Sync restores
the library. Same as a second device.

**Cloud-only user, lost passphrase.** Enter a recovery code, set a new passphrase.
Without a recovery code the account is reset and the documents are gone. Support
cannot help and says so.

**Self-hoster.** `docker compose up`. The container is the relay and stores the
library in SQLite on the mounted volume by default; no profile flag, no second
container. Open the app; no sign-in. Set a
passphrase, or set `RUSTUME_ALLOW_PLAINTEXT=true` and skip it. Back up by copying
`/data/rustume.db`. Later, link to Cloud from the account page to sync the same
library to a phone.

**Browser-only user.** Only the static build and the hosted app before sign-in.
Unchanged from today. Optional app lock. Manual export is the
backup.

## Relationship to existing RFCs

| RFC  | Status after this RFC | What changes                                                                                                                                                                                                                                                                                                 |
| ---- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0001 | Amended               | Default-on instead of opt-in; titles encrypted; Phase 1.5 server-managed encryption dropped; public pages handled by explicit publish instead of "Exclude"; enable flow also seals snapshot history; disable flow unavailable on Cloud. Envelope, KDF, recovery, rotation unchanged.                         |
| 0002 | Amended               | Sync protocol applies to all clients; `content_hash` becomes an HMAC content tag over the same canonical bytes; deletions become versioned tombstones and a local-only id with a relay tombstone is a conflict, not a create; self-hosted Postgres replaced by SQLite relay; pairing, LWW, unlink unchanged. |

Both documents should gain a note pointing here when this RFC is accepted. The
`docs/rfcs/` → `docs/rfc/` consolidation (RFC 0002 open question 5) is done in the
PR that adds this RFC.

## Migration from today

1. **New cloud accounts** go through passphrase setup before their first save.
2. **Existing cloud accounts** are prompted to set up encryption on next sign-in. Their
   plaintext rows are migrated client-side per RFC 0001's enable flow, extended to
   cover history: the client fetches and seals every `resume_snapshots` row for the
   account in the same pass, and the server's atomic toggle refuses to commit while
   any resume or snapshot row for the account is still plaintext. A grace period of
   one release cycle allows sign-in without setup; after it, setup is required to
   edit. Announced by email.
3. **Browser-only users** are unaffected until they sign in or start a relay.
4. **Existing `/api/resumes` CRUD** stays until the web client runs on the sync
   engine, then is removed. During the overlap both paths read and write the same
   rows and the same `version` column, and CRUD adopts the sync semantics rather
   than keeping its own: `DELETE /api/resumes/{id}` writes a versioned tombstone
   instead of today's hard delete with cascading snapshot removal, and the server's
   own snapshot capture on update (`db/snapshots.rs`) is switched off for sealed
   accounts, because the server cannot seal a snapshot. Snapshots for those accounts
   come only from the client through the sync snapshot endpoint, which is
   insert-only on `(resume_id, version)` and answers 409 to a different ciphertext
   for an existing version. History is never rewritten in place. For a migrated account, `/api/resumes` accepts only
   envelopes (422 otherwise, per RFC 0001) and returns envelopes; a client too old to
   handle envelopes gets 426 Upgrade Required rather than plaintext.
5. **`resume_snapshots`** keeps its shape. After migration every row for the account
   is an envelope, including history written before migration (step 2), and the
   snapshot writer rejects plaintext for sealed accounts.
6. **Disabling encryption** (RFC 0001's ciphertext-to-plaintext flow) is not
   available on Rustume Cloud. It exists only on a self-hosted relay with
   `RUSTUME_ALLOW_PLAINTEXT=true`.

## Rejected alternatives

| Alternative                                          | Why not                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Server-held keys at rest (#487)                      | Key next to data protects only a stolen volume; adds a data-loss point; operator can read. |
| Opt-in E2EE (RFC 0001 as written)                    | The default cloud user's data is readable. Contradicts the product promise.                |
| Always-on Postgres for self-hosted (#254 as written) | Second container for a single user; no path to desktop or mobile.                          |
| `sqlx::Any` instead of a repository trait            | Drops UUID, JSON, and chrono support; worse than two small implementations.                |
| Operator escrow for recovery                         | Explicitly rejected by the product owner. A backdoor by another name.                      |
| Plaintext content hash for sync                      | Leaks document equality and enables confirmation attacks against the database.             |
| Server-side search                                   | Requires readable content or searchable encryption; local search covers the need.          |

## Open questions

1. **Passkey-derived keys.** WebAuthn PRF could replace the passphrase for most users.
   Browser support and the recovery story need a spike before it becomes the default.
2. **Link-key public pages.** Worth offering as a second publish mode?
3. **Multi-user self-hosting.** Out of v1. Does it reuse WorkOS, or a local account table?
4. **Existing-account deadline.** One release cycle is a guess. Confirm with support load.
5. **Per-update envelopes.** Needed only if CRDT (#40) is adopted. Follow-up RFC.
6. **Client render gating.** Does the default flip per feature (export first, preview
   later) as #682 suggests, or all at once?

## Rollout plan

Phases are ordered by dependency. Each phase ships behind a flag and is usable on its
own. Implementation issues are opened when this RFC is accepted.

| Phase | Deliverable                                                                                                                              | Depends on         | Supersedes / extends                |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------- |
| 1     | `crates/crypto`, WASM bindings, `users.e2ee_config`, passphrase and recovery UI, default-on for new accounts, existing-account migration | RFC 0001 items 1–5 | #44, #369                           |
| 2     | Local-first web client: IndexedDB primary, sync engine on `/api/sync/*`, offline queue, conflict UI, status indicator                    | Phase 1            | #42, #43, #645, RFC 0002 orders 2–4 |
| 3     | `DocumentRepo` trait, SQLite engine, self-hosted relay on by default in `docker compose up`, access token, import-from-browser prompt    | Phase 2            | #254 (this issue), closes #487      |
| 4     | Client-side rendering: font strategy, lazy module, equivalence CI, offline export, server fallback toggle                                | #682 outcome       | #61, #633 follow-up                 |
| 5     | Explicit publish snapshots wired into #359 / #360; account export over envelopes (#353)                                                  | Phase 1            | #65, #408                           |
| 6     | Relay-to-Cloud linking, desktop and mobile clients on the shared crates                                                                  | Phases 2, 3        | RFC 0002 orders 1, 5–7; #9 Android  |

## References

- Tracking: [#254](https://github.com/lgtm-hq/Rustume/issues/254)
- Epic: [#243](https://github.com/lgtm-hq/Rustume/issues/243) Rustume Cloud
- Amends: [RFC 0001](./0001-e2e-encryption.md), [RFC 0002](./0002-local-cloud-linking.md)
- Closed by this RFC: [PR #487](https://github.com/lgtm-hq/Rustume/pull/487)
- Related: [#40](https://github.com/lgtm-hq/Rustume/issues/40) CRDT,
  [#42](https://github.com/lgtm-hq/Rustume/issues/42) offline queue,
  [#43](https://github.com/lgtm-hq/Rustume/issues/43) conflict UI,
  [#44](https://github.com/lgtm-hq/Rustume/issues/44) E2EE,
  [#65](https://github.com/lgtm-hq/Rustume/issues/65) public pages,
  [#353](https://github.com/lgtm-hq/Rustume/issues/353) account export,
  [#633](https://github.com/lgtm-hq/Rustume/issues/633) privacy claim,
  [#645](https://github.com/lgtm-hq/Rustume/issues/645) save and sync status,
  [#682](https://github.com/lgtm-hq/Rustume/issues/682) WASM rendering
