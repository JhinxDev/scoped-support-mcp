# Security boundaries

This is a synthetic local demonstration, not a production security product.

- The upstream is fixed to loopback HTTP. Tool inputs cannot supply a URL, token, tenant, command or query language.
- A random in-memory bearer token protects the fixture. The local process operator controls the demo tenant; this is not end-user authentication or OAuth.
- Two read tools use strict input schemas. Read-only annotations describe behavior; the implementation enforces it.
- The adapter checks tenant membership independently and returns an explicit field allowlist. Missing and inaccessible IDs share NOT_FOUND.
- Responses are bounded to 16 KiB, with an 800 ms default request timeout and at most 100 validated records. Lists return at most 10 records.
- The local process allows 30 calls per minute. This is not a distributed rate limiter. Upstream failures are sanitized and do not trigger automatic retries.
- Audit events include request ID, allowlisted tool name and outcome. They omit tokens, arguments and record bodies. No persistent log sink is configured.
- Ticket notes are untrusted data. No model executes them in this example. Real hosts need separate adversarial testing and permission enforcement.

Production work would require authenticated identity, authorization review, protected transport, secret lifecycle, vendor-specific contracts, logging policy and host acceptance. Dependency audits check known advisories, not all possible vulnerabilities. Do not include credentials or customer records in bug reports.
