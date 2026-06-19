# Security Policy

## Supported Versions

<!-- markdownlint-disable MD060 -- emoji triggers false positive -->

| Version   | Supported |
| --------- | --------- |
| `0.20.x`  | ✅        |
| `< 0.20`  | ❌        |

Current release line matches the workspace version in `Cargo.toml` (currently `0.20.0`).

<!-- markdownlint-enable MD060 -->

## Reporting Security Issues

Found a security vulnerability? Here's how to report it:

### **Private Reporting Only**

Please **do not** create public GitHub issues for security vulnerabilities. This
helps prevent potential exploitation while we work on a fix.

### **How to Report**

1. **Email**: Send details to `turbocoder13@gmail.com`
2. **Subject**: Include "SECURITY: Rustume" in the subject line
3. **Canonical contact file**: See [security.txt](https://rustume.com/.well-known/security.txt)
4. **Backup**: Create a [private security advisory][advisory]

[advisory]: https://github.com/lgtm-hq/Rustume/security/advisories/new

### **Encrypted Reports**

If you need to send an encrypted report, reply to your acknowledgment email and
we will provide a PGP public key for follow-up communication.

### **What to Include**

- Description of the vulnerability
- Steps to reproduce (if possible)
- Potential impact assessment
- Any suggested fixes you might have

### **Response Timeline**

- **Acknowledgment**: Within 24-48 hours
- **Assessment**: Initial severity assessment within 7 calendar days
- **Updates**: You'll be kept informed of progress
- **Fix**: We'll work on a solution and coordinate disclosure

## Data Classification

Rustume deployments handle two classes of data:

- **Account identity metadata** — WorkOS identifiers, session records, billing
  references, and similar operator-managed account state. This metadata is
  minimized but may still be sensitive.
- **Resume documents** — User-authored resume JSON and rendered exports. These
  documents may contain personal data (names, contact details, employment
  history) and must be protected in transit and at rest.

Public documentation describes workflows and operator responsibilities. Exact
production retention values, recovery targets, and restricted runbook detail
belong in private operations documentation.

## For Contributors

- Review dependencies regularly
- Test security-related changes thoroughly
- Never commit sensitive data (API keys, passwords, etc.)
- Follow secure coding practices

## Security Updates

Security fixes will be released as patch versions and documented in
[GitHub Releases](https://github.com/lgtm-hq/Rustume/releases).

## Security Measures

This project implements the following security practices:

- [OpenSSF Scorecard][scorecard] for supply chain security
- Dependency review on pull requests
- Container image scanning with Trivy
- Signed commits and releases
- Pinned GitHub Actions dependencies
- Append-only audit logging for authentication and destructive resume operations
- JSON complexity limits on resume payloads

[scorecard]: https://github.com/lgtm-hq/Rustume/actions/workflows/scorecards.yml

## Contact

- **Primary**: `turbocoder13@gmail.com`
- **security.txt**: `https://rustume.com/.well-known/security.txt`
- **Backup**: Create a [private security advisory][advisory]
