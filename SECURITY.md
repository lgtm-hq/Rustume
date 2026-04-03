# Security Policy

## Supported Versions

<!-- markdownlint-disable MD060 -- emoji triggers false positive -->

| Version   | Supported |
| --------- | --------- |
| `v0.10.x` | ✅        |
| `< 0.10`  | ❌        |

<!-- markdownlint-enable MD060 -->

## Reporting Security Issues

Found a security vulnerability? Here's how to report it:

### **Private Reporting Only**

Please **do not** create public GitHub issues for security vulnerabilities. This
helps prevent potential exploitation while we work on a fix.

### **How to Report**

1. **Email**: Send details to `turbocoder13@gmail.com`
2. **Subject**: Include "SECURITY: Rustume" in the subject line
3. **Backup**: Create a [private security advisory][advisory]

[advisory]: https://github.com/lgtm-hq/Rustume/security/advisories/new

### **What to Include**

- Description of the vulnerability
- Steps to reproduce (if possible)
- Potential impact assessment
- Any suggested fixes you might have

### **Response Timeline**

- **Acknowledgment**: Within 24-48 hours
- **Investigation**: We'll look into it promptly
- **Updates**: You'll be kept informed of progress
- **Fix**: We'll work on a solution and coordinate disclosure

## For Contributors

- Review dependencies regularly
- Test security-related changes thoroughly
- Never commit sensitive data (API keys, passwords, etc.)
- Follow secure coding practices

## Security Updates

Security fixes will be released as patch versions and documented in
[CHANGELOG.md](CHANGELOG.md).

## Security Measures

This project implements the following security practices:

- [OpenSSF Scorecard][scorecard] for supply chain security
- Dependency review on pull requests
- Container image scanning with Trivy
- Signed commits and releases
- Pinned GitHub Actions dependencies

[scorecard]: https://github.com/lgtm-hq/Rustume/actions/workflows/scorecards.yml

## Contact

- **Primary**: `turbocoder13@gmail.com`
- **Backup**: Create a private security issue in GitHub
