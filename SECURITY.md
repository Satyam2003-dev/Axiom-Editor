# Security Policy

## Reporting a vulnerability

Please do not open a public issue for an undisclosed vulnerability. Use GitHub's **Report a vulnerability** option in the repository Security tab. If private vulnerability reporting is unavailable, contact the repository owner privately through their GitHub profile.

Include the affected version, platform, reproduction steps, impact, and any suggested mitigation. Do not include real API keys or private source code.

## Supported versions

Security fixes are provided for the latest published Axiom Editor release. This community project does not currently promise long-term support for older releases.

## Security boundaries

Axiom Editor can send repository context and prompts to model providers selected by the user. Review each provider's privacy policy, use local models for sensitive work where appropriate, and keep secrets out of prompts. Extensions and MCP servers can execute with significant local access; install only software you trust.
