# Security Policy

## Supported Versions

Michibiki is currently in MVP status.

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Reporting a Vulnerability

Please do not disclose security vulnerabilities in public issues before they are triaged.

Use GitHub private vulnerability reporting or contact the maintainer through the repository owner profile. Include:

- A concise description of the issue.
- Reproduction steps or a minimal proof of concept.
- Affected package, command, or generated output path.
- Any impact on local files, command execution, credentials, or generated artifacts.

## Security Scope

Michibiki is a local CLI-first tool. Generated jobs may contain prompts, metadata, asset paths, and render outputs. They are written under `outputs/jobs/` and ignored by git by default.

Third-party engines such as Remotion, HyperFrames, and Editframe remain governed by their own security policies, licenses, and terms.
