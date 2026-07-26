//! Bakes optional build metadata into the server binary.
//!
//! `GIT_COMMIT` and `BUILD_TIME` are supplied by `docker/Dockerfile` (fed from
//! CI). They are re-exported as `RUSTUME_GIT_COMMIT` / `RUSTUME_BUILD_TIME` so
//! `crates/server/src/routes/version.rs` can read them with `option_env!`.
//!
//! Two reasons this lives in a build script rather than reading `GIT_COMMIT`
//! directly with `option_env!`:
//!
//! - Cargo does not track arbitrary environment variables in a crate's
//!   fingerprint, so a rebuild with unchanged sources but a new commit would
//!   silently reuse a binary carrying the previous commit. The
//!   `rerun-if-env-changed` directives below make the change observable.
//! - Absent or blank metadata is dropped here, so `option_env!` yields `None`
//!   and the endpoint reports `null` instead of an empty string.

/// Build metadata variables read from the environment, in
/// `(input, exported)` form.
const METADATA_VARS: [(&str, &str); 2] = [
    ("GIT_COMMIT", "RUSTUME_GIT_COMMIT"),
    ("BUILD_TIME", "RUSTUME_BUILD_TIME"),
];

fn main() {
    println!("cargo::rerun-if-changed=build.rs");

    for (input, exported) in METADATA_VARS {
        println!("cargo::rerun-if-env-changed={input}");

        let Ok(value) = std::env::var(input) else {
            continue;
        };
        let value = value.trim();
        // A value containing whitespace would corrupt the `cargo::` directive
        // line, so ignore anything that is not a single bare token.
        if value.is_empty() || value.split_whitespace().count() != 1 {
            continue;
        }

        println!("cargo::rustc-env={exported}={value}");
    }
}
