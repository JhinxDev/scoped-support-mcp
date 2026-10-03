# Case study: scoped support lookup

## Problem

A support assistant needs a ticket's status. Giving it an unrestricted API client would expose more operations and fields than the task requires.

## Approach

Build two explicit read operations around a fictional HTTP API. Validate tool arguments, enforce a configured tenant independently of upstream filtering, and return only four public fields. Keep network failures bounded and logs minimal.

## Evidence

The runnable SDK client discovers both tools and retrieves A-101. The same client is denied B-201. Tests deliberately return mixed-tenant upstream records and confirm that the adapter still filters them. Separate cases check malformed and oversized responses, timeouts, upstream authentication, local rate limits and both tested protocol revisions.

## Tradeoffs

The fixture launches in the server process, making the example self-contained but unlike a real vendor deployment. Tenant selection is operator configuration, not authenticated identity. Local limits reset with process state. No model or commercial host participates, so the result demonstrates adapter behavior rather than AI safety or production compatibility.

## Relevant work sample

This can support conversations about a small read-only MCP adapter, API response filtering or integration tests. It does not establish expertise in enterprise authentication or experience delivering paid client projects.
