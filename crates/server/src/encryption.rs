//! Application-level AES-256-GCM encryption for resume data at rest.
//!
//! The encryption key is resolved in priority order:
//!
//! 1. `RUSTUME_ENCRYPTION_KEY` environment variable (hex-encoded 32 bytes)
//! 2. Key file (`RUSTUME_ENCRYPTION_KEY_FILE`, default `/data/.encryption_key`)
//! 3. Auto-generated random key persisted to the key file (with a warning)
//!
//! Encrypted blobs are laid out as `nonce (12 bytes) || ciphertext`.

use aes_gcm::aead::{Aead, OsRng, Payload};
use aes_gcm::{AeadCore, Aes256Gcm, Key, KeyInit};
use std::path::{Path, PathBuf};
use tracing::{info, warn};

/// AES-256-GCM nonce length in bytes.
const NONCE_LEN: usize = 12;

/// AES-256 key length in bytes.
const KEY_LEN: usize = 32;

/// Default on-disk location for the auto-generated encryption key.
pub const DEFAULT_KEY_FILE: &str = "/data/.encryption_key";

/// Environment variable holding a hex-encoded 32-byte encryption key.
pub const KEY_ENV: &str = "RUSTUME_ENCRYPTION_KEY";

/// Environment variable overriding the key file path.
pub const KEY_FILE_ENV: &str = "RUSTUME_ENCRYPTION_KEY_FILE";

/// Symmetric encryption service for resume JSON blobs.
#[derive(Clone)]
pub struct EncryptionService {
    cipher: Aes256Gcm,
}

impl std::fmt::Debug for EncryptionService {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("EncryptionService")
            .field("cipher", &"<aes-256-gcm>")
            .finish()
    }
}

impl EncryptionService {
    /// Build a service from raw key bytes (tests and callers with managed keys).
    #[must_use]
    pub fn from_key(key: &[u8; KEY_LEN]) -> Self {
        let key = Key::<Aes256Gcm>::from(*key);
        Self {
            cipher: Aes256Gcm::new(&key),
        }
    }

    /// Load the key from the environment or key file, generating one if needed.
    pub fn init() -> anyhow::Result<Self> {
        let env_key = std::env::var(KEY_ENV)
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        Self::init_with(env_key.as_deref(), &key_file_path())
    }

    /// Returns `true` when key material is already configured (env var or key file).
    ///
    /// Used to decide whether decryption support should be wired up even when
    /// encryption of new writes is disabled.
    #[must_use]
    pub fn key_configured() -> bool {
        std::env::var(KEY_ENV).is_ok_and(|value| !value.trim().is_empty())
            || key_file_path().exists()
    }

    /// Resolve the key from an optional hex env value or a key file path.
    ///
    /// Generates and persists a new key to `key_file` when neither source
    /// provides one.
    pub fn init_with(env_key: Option<&str>, key_file: &Path) -> anyhow::Result<Self> {
        if let Some(hex_key) = env_key {
            let key = decode_hex_key(hex_key)?;
            info!("Encryption key loaded from {KEY_ENV}");
            return Ok(Self::from_key(&key));
        }

        if key_file.exists() {
            let key = read_key_file(key_file)?;
            info!(path = %key_file.display(), "Encryption key loaded from key file");
            return Ok(Self::from_key(&key));
        }

        let key: [u8; KEY_LEN] = Aes256Gcm::generate_key(OsRng).into();
        if write_key_file(key_file, &key)? {
            warn!(
                path = %key_file.display(),
                "Auto-generated encryption key at {} — back up this file. If lost, encrypted \
                 resume data is unrecoverable.",
                key_file.display()
            );
            return Ok(Self::from_key(&key));
        }

        // Lost a concurrent-startup race: another process persisted a key
        // first. Discard ours and use the on-disk key so all instances agree.
        let key = read_key_file(key_file)?;
        info!(path = %key_file.display(), "Encryption key loaded from key file");
        Ok(Self::from_key(&key))
    }

    /// Encrypt resume JSON into a `nonce || ciphertext` blob.
    ///
    /// `aad` (associated data, e.g. the resume ID) is authenticated but not
    /// encrypted: decryption fails if the blob is moved to a different row.
    pub fn encrypt(&self, data: &serde_json::Value, aad: &[u8]) -> anyhow::Result<Vec<u8>> {
        let plaintext = serde_json::to_vec(data)?;
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ciphertext = self
            .cipher
            .encrypt(
                &nonce,
                Payload {
                    msg: plaintext.as_slice(),
                    aad,
                },
            )
            .map_err(|_| anyhow::anyhow!("encryption failed"))?;

        let mut blob = Vec::with_capacity(NONCE_LEN + ciphertext.len());
        blob.extend_from_slice(&nonce);
        blob.extend_from_slice(&ciphertext);
        Ok(blob)
    }

    /// Decrypt a `nonce || ciphertext` blob back into resume JSON.
    ///
    /// `aad` must match the associated data supplied at encryption time.
    pub fn decrypt(&self, blob: &[u8], aad: &[u8]) -> anyhow::Result<serde_json::Value> {
        if blob.len() <= NONCE_LEN {
            anyhow::bail!("encrypted blob is too short");
        }
        let (nonce, ciphertext) = blob.split_at(NONCE_LEN);
        let plaintext = self
            .cipher
            .decrypt(
                nonce.into(),
                Payload {
                    msg: ciphertext,
                    aad,
                },
            )
            .map_err(|_| anyhow::anyhow!("decryption failed: wrong key or corrupted data"))?;
        Ok(serde_json::from_slice(&plaintext)?)
    }
}

/// Resolve the key file path from the environment, defaulting to `/data/.encryption_key`.
fn key_file_path() -> PathBuf {
    std::env::var(KEY_FILE_ENV)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .map_or_else(|| PathBuf::from(DEFAULT_KEY_FILE), PathBuf::from)
}

fn decode_hex_key(hex_key: &str) -> anyhow::Result<[u8; KEY_LEN]> {
    let bytes = hex::decode(hex_key.trim())
        .map_err(|_| anyhow::anyhow!("{KEY_ENV} must be hex-encoded"))?;
    <[u8; KEY_LEN]>::try_from(bytes.as_slice())
        .map_err(|_| anyhow::anyhow!("{KEY_ENV} must decode to exactly {KEY_LEN} bytes"))
}

fn read_key_file(path: &Path) -> anyhow::Result<[u8; KEY_LEN]> {
    let contents = std::fs::read_to_string(path)
        .map_err(|err| anyhow::anyhow!("failed to read encryption key file {path:?}: {err}"))?;
    decode_hex_key(&contents)
        .map_err(|err| anyhow::anyhow!("invalid encryption key file {path:?}: {err}"))
}

/// Atomically publish the key file with owner-only permissions.
///
/// The key is written and fsynced to a mode-0600 temporary sibling first, then
/// hard-linked into place — the final path only ever holds a complete key, and
/// linking fails (without overwriting) if another process published first.
///
/// Returns `Ok(false)` when the file already exists (a concurrent process
/// persisted a key first); the caller should reload it instead.
fn write_key_file(path: &Path, key: &[u8; KEY_LEN]) -> anyhow::Result<bool> {
    use std::io::Write;

    if path.exists() {
        return Ok(false);
    }

    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    std::fs::create_dir_all(parent).map_err(|err| {
        anyhow::anyhow!("failed to create encryption key directory {parent:?}: {err}")
    })?;

    let tmp_path = path.with_extension(format!("tmp.{}", std::process::id()));
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        // 0600 from the very first syscall — no umask-dependent window where
        // the key is readable by other users.
        options.mode(0o600);
    }

    let write_result = options
        .open(&tmp_path)
        .and_then(|mut file| {
            file.write_all(hex::encode(key).as_bytes())?;
            file.sync_all()
        })
        .map_err(|err| anyhow::anyhow!("failed to write encryption key file {tmp_path:?}: {err}"));
    if let Err(err) = write_result {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(err);
    }

    // Hard-link is atomic and never overwrites: exactly one process wins.
    let publish = std::fs::hard_link(&tmp_path, path);
    let _ = std::fs::remove_file(&tmp_path);
    match publish {
        Ok(()) => {
            sync_dir(parent)?;
            Ok(true)
        }
        Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => Ok(false),
        Err(err) => Err(anyhow::anyhow!(
            "failed to publish encryption key file {path:?}: {err}"
        )),
    }
}

/// Fsync a directory so a freshly published key's directory entry is durable.
fn sync_dir(dir: &Path) -> anyhow::Result<()> {
    #[cfg(unix)]
    {
        std::fs::File::open(dir)
            .and_then(|handle| handle.sync_all())
            .map_err(|err| {
                anyhow::anyhow!("failed to sync encryption key directory {dir:?}: {err}")
            })?;
    }
    #[cfg(not(unix))]
    {
        let _ = dir;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_key(seed: u8) -> [u8; KEY_LEN] {
        [seed; KEY_LEN]
    }

    const AAD: &[u8] = b"resume-1";

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let service = EncryptionService::from_key(&test_key(1));
        let data = serde_json::json!({"basics": {"name": "Ada Lovelace"}, "n": 42});

        let blob = service.encrypt(&data, AAD).expect("encrypt");
        assert_ne!(blob, serde_json::to_vec(&data).expect("serialize"));

        let decrypted = service.decrypt(&blob, AAD).expect("decrypt");
        assert_eq!(decrypted, data);
    }

    #[test]
    fn decrypt_with_wrong_aad_fails() {
        let service = EncryptionService::from_key(&test_key(1));
        let blob = service
            .encrypt(&serde_json::json!({"secret": true}), AAD)
            .expect("encrypt");

        assert!(
            service.decrypt(&blob, b"resume-2").is_err(),
            "a blob moved to another row must not decrypt"
        );
    }

    #[test]
    fn encrypt_produces_unique_blobs_per_call() {
        let service = EncryptionService::from_key(&test_key(1));
        let data = serde_json::json!({"a": 1});

        let first = service.encrypt(&data, AAD).expect("encrypt");
        let second = service.encrypt(&data, AAD).expect("encrypt");
        assert_ne!(first, second, "nonces must be random per encryption");
    }

    #[test]
    fn decrypt_with_wrong_key_fails() {
        let encryptor = EncryptionService::from_key(&test_key(1));
        let attacker = EncryptionService::from_key(&test_key(2));
        let blob = encryptor
            .encrypt(&serde_json::json!({"secret": true}), AAD)
            .expect("encrypt");

        let err = attacker
            .decrypt(&blob, AAD)
            .expect_err("wrong key must fail");
        assert!(err.to_string().contains("decryption failed"));
    }

    #[test]
    fn decrypt_rejects_tampered_ciphertext() {
        let service = EncryptionService::from_key(&test_key(1));
        let mut blob = service
            .encrypt(&serde_json::json!({"secret": true}), AAD)
            .expect("encrypt");
        let last = blob.len() - 1;
        blob[last] ^= 0xff;

        assert!(service.decrypt(&blob, AAD).is_err());
    }

    #[test]
    fn decrypt_rejects_truncated_blob() {
        let service = EncryptionService::from_key(&test_key(1));
        assert!(service.decrypt(&[0u8; NONCE_LEN], AAD).is_err());
    }

    #[test]
    fn init_with_env_key_takes_priority() {
        let dir = tempfile::tempdir().expect("tempdir");
        let key_file = dir.path().join(".encryption_key");
        let hex_key = hex::encode(test_key(7));

        let service =
            EncryptionService::init_with(Some(&hex_key), &key_file).expect("init from env");
        let expected = EncryptionService::from_key(&test_key(7));

        let blob = service
            .encrypt(&serde_json::json!({"x": 1}), AAD)
            .expect("encrypt");
        assert_eq!(
            expected.decrypt(&blob, AAD).expect("decrypt with same key"),
            serde_json::json!({"x": 1})
        );
        assert!(!key_file.exists(), "env key must not touch the key file");
    }

    #[test]
    fn init_with_rejects_invalid_env_key() {
        let dir = tempfile::tempdir().expect("tempdir");
        let key_file = dir.path().join(".encryption_key");

        assert!(EncryptionService::init_with(Some("not-hex"), &key_file).is_err());
        assert!(EncryptionService::init_with(Some("abcd"), &key_file).is_err());
    }

    #[test]
    fn init_with_generates_and_persists_key() {
        let dir = tempfile::tempdir().expect("tempdir");
        let key_file = dir.path().join("nested").join(".encryption_key");

        let first = EncryptionService::init_with(None, &key_file).expect("generate key");
        assert!(key_file.exists(), "generated key must be persisted");

        let second = EncryptionService::init_with(None, &key_file).expect("reload key");
        let blob = first
            .encrypt(&serde_json::json!({"persisted": true}), AAD)
            .expect("encrypt");
        assert_eq!(
            second
                .decrypt(&blob, AAD)
                .expect("decrypt with reloaded key"),
            serde_json::json!({"persisted": true}),
            "reloaded key must match the generated key"
        );
    }

    #[cfg(unix)]
    #[test]
    fn generated_key_file_is_owner_read_write_only() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempfile::tempdir().expect("tempdir");
        let key_file = dir.path().join(".encryption_key");
        EncryptionService::init_with(None, &key_file).expect("generate key");

        let mode = std::fs::metadata(&key_file)
            .expect("metadata")
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600);
    }
}
