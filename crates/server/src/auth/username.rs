//! Friendly username generation and validation for Rustume Cloud accounts.

use std::sync::OnceLock;

use regex::Regex;
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

/// Validation rules shared with the web client (`apps/web/src/api/account.ts`
/// imports the same JSON), so reserved names and length bounds cannot drift.
#[derive(Debug, serde::Deserialize)]
struct UsernameRules {
    min_length: usize,
    max_length: usize,
    /// Charset and hyphen rules as one anchored regex.
    pattern: String,
    reserved: Vec<String>,
}

fn pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN
        .get_or_init(|| Regex::new(&rules().pattern).expect("username_rules.json pattern is valid"))
}

const USERNAME_RULES_JSON: &str = include_str!("username_rules.json");

fn rules() -> &'static UsernameRules {
    static RULES: OnceLock<UsernameRules> = OnceLock::new();
    RULES.get_or_init(|| {
        serde_json::from_str(USERNAME_RULES_JSON).expect("username_rules.json is valid")
    })
}

/// Reserved handles that can never be chosen (route segments, brand names).
pub fn reserved_usernames() -> &'static [String] {
    &rules().reserved
}

/// Generate a friendly adjective-noun-number handle (e.g. `swift-otter-4821`).
pub fn generate_username() -> String {
    let id = Uuid::new_v4();
    let bytes = id.as_bytes();
    let adj_index = usize::from(bytes[0]) % ADJECTIVES.len();
    let noun_index = usize::from(bytes[1]) % NOUNS.len();
    let number = 1000 + (u16::from(bytes[2]) * 256 + u16::from(bytes[3])) % 9000;
    format!("{}-{}-{}", ADJECTIVES[adj_index], NOUNS[noun_index], number)
}

/// Validate a username against the shared rules: length bounds, the
/// charset/hyphen pattern, and reserved words.
pub fn validate_username(username: &str) -> Result<(), String> {
    let username = username.trim();
    let rules = rules();
    if username.len() < rules.min_length || username.len() > rules.max_length {
        return Err(format!(
            "username must be {}-{} characters",
            rules.min_length, rules.max_length
        ));
    }
    if !pattern().is_match(username) {
        // The pattern is the rule; the two messages only explain which part
        // of it failed. Same split as the web client.
        return Err(
            if username
                .chars()
                .any(|ch| !(ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-'))
            {
                "username may only contain lowercase letters, digits, and hyphens".to_string()
            } else {
                "username cannot start, end, or contain consecutive hyphens".to_string()
            },
        );
    }
    if rules.reserved.iter().any(|reserved| reserved == username) {
        return Err("username is reserved".to_string());
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
            validate_username("Swift-Otter").err().as_deref(),
            Some("username may only contain lowercase letters, digits, and hyphens")
        );
        assert_eq!(
            validate_username("user_name").err().as_deref(),
            Some("username may only contain lowercase letters, digits, and hyphens")
        );
    }

    #[test]
    fn validate_username_rejects_bad_length() {
        assert_eq!(
            validate_username("ab").err().as_deref(),
            Some("username must be 3-32 characters")
        );
        assert_eq!(
            validate_username(&"a".repeat(33)).err().as_deref(),
            Some("username must be 3-32 characters")
        );
    }

    #[test]
    fn validate_username_rejects_bad_hyphens() {
        assert_eq!(
            validate_username("-swift").err().as_deref(),
            Some("username cannot start, end, or contain consecutive hyphens")
        );
        assert_eq!(
            validate_username("swift-").err().as_deref(),
            Some("username cannot start, end, or contain consecutive hyphens")
        );
        assert_eq!(
            validate_username("swift--otter").err().as_deref(),
            Some("username cannot start, end, or contain consecutive hyphens")
        );
    }

    #[test]
    fn validate_username_rejects_reserved_words() {
        for reserved in reserved_usernames() {
            if reserved.len() < 3 || reserved.len() > 32 {
                continue;
            }
            assert_eq!(
                validate_username(reserved).err().as_deref(),
                Some("username is reserved"),
                "expected {reserved} to be reserved"
            );
        }
    }

    #[test]
    fn shared_rules_are_well_formed() {
        let rules = rules();
        assert_eq!(rules.min_length, 3);
        assert_eq!(rules.max_length, 32);
        assert!(pattern().is_match("swift-otter-4821"));
        assert!(!pattern().is_match("-swift"));
        assert!(!pattern().is_match("swift--otter"));
        assert!(!pattern().is_match("Swift"));
        let mut sorted = rules.reserved.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(
            sorted, rules.reserved,
            "reserved list must be sorted and unique"
        );
        for reserved in &rules.reserved {
            assert_eq!(reserved, &reserved.to_ascii_lowercase());
            assert!(!reserved.is_empty());
        }
    }

    #[test]
    fn normalize_username_lowercases_and_trims() {
        assert_eq!(normalize_username("  Swift-Otter-42  "), "swift-otter-42");
    }
}
