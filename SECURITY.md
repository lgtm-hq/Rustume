# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public issue**
2. Use [GitHub Security Advisories](https://github.com/lgtm-hq/Rustume/security/advisories/new) to report the vulnerability privately
3. Alternatively, email security findings to the maintainers via the contact information in their GitHub profiles

### What to expect

- **Acknowledgment**: Within 48 hours of your report
- **Assessment**: We will evaluate the severity and impact within 1 week
- **Fix timeline**: Critical vulnerabilities will be prioritized for the next release

### Scope

This policy applies to the latest release of Rustume and its Docker images.

## Security Measures

This project implements the following security practices:

- [OpenSSF Scorecard](https://github.com/lgtm-hq/Rustume/actions/workflows/scorecards.yml) for supply chain security
- Dependency review on pull requests
- Container image scanning with Trivy
- Signed commits and releases
- Pinned GitHub Actions dependencies
