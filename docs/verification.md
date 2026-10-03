# Verification record

Verified October 3, 2026 on Windows with Node.js 24.15.0.

| Check | Result |
| --- | --- |
| Locked dependency install, lifecycle scripts disabled | Passed; 14 packages installed |
| Syntax check | Passed |
| Automated tests | 15 passed, 0 failed |
| Real SDK stdio demo | Both tools discovered; allowed and denied reads observed |
| npm known-advisory audit during install | 0 reported vulnerabilities across 15 audited packages |

The tests include real localhost HTTP and SDK subprocess communication. Dependency results are time-specific and do not constitute a complete source security audit. Run npm audit to refresh.

The included CI workflow targets Windows and Ubuntu with Node 24, read-only repository permissions and actions pinned to commits. Windows and Ubuntu CI passed. Commercial host UI integration, production identity, deployment and owner walkthrough remain unverified.

Hosted acceptance evidence: [successful Windows and Ubuntu run](https://github.com/JhinxDev/scoped-support-mcp/actions/runs/37103462555). This run verifies the initial source release; the README badge tracks subsequent revisions.
