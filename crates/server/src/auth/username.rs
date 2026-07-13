//! Friendly username generation and validation for Rustume Cloud accounts.

use uuid::Uuid;

const ADJECTIVES: [&str; 64] = [
    "swift", "bright", "calm", "bold", "keen", "warm", "cool", "crisp", "lively", "gentle",
    "sturdy", "nimble", "clever", "merry", "lucky", "happy", "honest", "patient", "modest",
    "eager", "loyal", "steady", "smooth", "sharp", "clear", "cozy", "daring", "dreamy", "fair",
    "fancy", "grand", "hardy", "jolly", "kind", "light", "noble", "quiet", "rapid", "shy", "sunny",
    "tidy", "vital", "witty", "amber", "brave", "brisk", "dainty", "floral", "golden", "humble",
    "ivory", "jade", "lemon", "minty", "olive", "pearl", "royal", "satin", "teal", "urban",
    "vivid", "young", "zesty", "agile",
];

const NOUNS: [&str; 64] = [
    "otter", "falcon", "beacon", "canyon", "cedar", "dolphin", "ember", "finch", "glacier",
    "harbor", "iris", "jaguar", "kelpie", "lynx", "maple", "narwhal", "oracle", "panda", "quill",
    "raven", "sparrow", "tiger", "urchin", "violet", "willow", "xenon", "yak", "zephyr", "badger",
    "comet", "drake", "egret", "fjord", "goose", "heron", "ibis", "jewel", "koala", "lotus",
    "moss", "nova", "pebble", "quest", "river", "storm", "thorn", "unity", "vortex", "wolf",
    "alder", "birch", "coral", "daisy", "elm", "fern", "grove", "hazel", "ivy", "juniper", "kite",
    "laurel", "mirth", "nebula", "osprey",
];

const RESERVED_USERNAMES: &[&str] = &[
    "admin",
    "api",
    "auth",
    "account",
    "resume",
    "r",
    "rustume",
    "settings",
    "support",
    "help",
    "www",
    "root",
    "login",
    "logout",
    "signup",
    "register",
    "dashboard",
    "billing",
    "export",
    "import",
    "me",
];

/// Generate a friendly adjective-noun-number handle (e.g. `swift-otter-4821`).
pub fn generate_username() -> String {
    let id = Uuid::new_v4();
    let bytes = id.as_bytes();
    let adj_index = usize::from(bytes[0]) % ADJECTIVES.len();
    let noun_index = usize::from(bytes[1]) % NOUNS.len();
    let number = 1000 + (u16::from(bytes[2]) as u16 * 256 + u16::from(bytes[3])) % 9000;
    format!("{}-{}-{}", ADJECTIVES[adj_index], NOUNS[noun_index], number)
}

/// Validate a username for charset, length, hyphen rules, and reserved words.
pub fn validate_username(username: &str) -> Result<(), &'static str> {
    let username = username.trim();
    if username.len() < 3 || username.len() > 32 {
        return Err("username must be 3-32 characters");
    }
    if username.starts_with('-') || username.ends_with('-') || username.contains("--") {
        return Err("username cannot start, end, or contain consecutive hyphens");
    }
    if !username
        .chars()
        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-')
    {
        return Err("username may only contain lowercase letters, digits, and hyphens");
    }
    if RESERVED_USERNAMES.contains(&username) {
        return Err("username is reserved");
    }
    Ok(())
}

/// Normalize user input to lowercase trimmed form.
pub fn normalize_username(username: &str) -> String {
    username.trim().to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn generate_username_matches_adjective_noun_number_shape() {
        let username = generate_username();
        let parts: Vec<&str> = username.split('-').collect();
        assert_eq!(parts.len(), 3, "expected adjective-noun-number: {username}");
        assert!(ADJECTIVES.contains(&parts[0]));
        assert!(NOUNS.contains(&parts[1]));
        let number: u16 = parts[2].parse().expect("numeric suffix");
        assert!((1000..=9999).contains(&number));
    }

    #[test]
    fn generate_username_produces_varied_handles() {
        let handles: HashSet<String> = (0..32).map(|_| generate_username()).collect();
        assert!(handles.len() > 1, "expected varied generated usernames");
    }

    #[test]
    fn validate_username_accepts_valid_handles() {
        for username in ["swift-otter-4821", "ada", "user-42", "a1b2c3"] {
            assert_eq!(validate_username(username), Ok(()), "rejected {username}");
        }
    }

    #[test]
    fn validate_username_rejects_invalid_charset() {
        assert_eq!(
            validate_username("Swift-Otter"),
            Err("username may only contain lowercase letters, digits, and hyphens")
        );
        assert_eq!(
            validate_username("user_name"),
            Err("username may only contain lowercase letters, digits, and hyphens")
        );
    }

    #[test]
    fn validate_username_rejects_bad_length() {
        assert_eq!(
            validate_username("ab"),
            Err("username must be 3-32 characters")
        );
        assert_eq!(
            validate_username(&"a".repeat(33)),
            Err("username must be 3-32 characters")
        );
    }

    #[test]
    fn validate_username_rejects_bad_hyphens() {
        assert_eq!(
            validate_username("-swift"),
            Err("username cannot start, end, or contain consecutive hyphens")
        );
        assert_eq!(
            validate_username("swift-"),
            Err("username cannot start, end, or contain consecutive hyphens")
        );
        assert_eq!(
            validate_username("swift--otter"),
            Err("username cannot start, end, or contain consecutive hyphens")
        );
    }

    #[test]
    fn validate_username_rejects_reserved_words() {
        for reserved in RESERVED_USERNAMES {
            assert_eq!(
                validate_username(reserved),
                Err("username is reserved"),
                "expected {reserved} to be reserved"
            );
        }
    }

    #[test]
    fn normalize_username_lowercases_and_trims() {
        assert_eq!(normalize_username("  Swift-Otter-42  "), "swift-otter-42");
    }
}
