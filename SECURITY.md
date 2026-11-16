# Security Policy

## Supported Versions

Security fixes are applied to the latest published version of `monocon`. Older versions are not maintained.

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| older   | :x:                |

## Reporting a Vulnerability

Please do **not** report security vulnerabilities through public GitHub issues.

Instead, report them privately using GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Fill in the affected version, reproduction steps, and impact.

You should receive an acknowledgement within a few days. If a fix is available, you will be notified before the advisory is published.

## Scope

Report issues that affect the security of `monocon` or its users, such as:

- Vulnerabilities in request validation or routing.
- Unsafe handling of configuration or generated files.
- Dependency issues that expose `monocon` consumers to risk.

Please avoid reporting general bugs, feature requests, or vulnerabilities in dependencies that do not originate in this project.
