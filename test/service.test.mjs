import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { makeService } from '../src/service.mjs';
import { startFixture } from '../fixtures/support-api.mjs';

async function service(t, options = {}) {
  const fixture = await startFixture(options);
  t.after(fixture.close);
  return { fixture, call: makeService({ ...fixture, tenant: options.tenant ?? 'alpha', ...options }) };
}
test('tenant isolation, minimization, status filtering and bounded results', async t => {
  const { call } = await service(t);
  const result = await call('list_tickets', { status: 'all', limit: 1 });
  assert.equal(result.structuredContent.tickets.length, 1);
  assert.equal(result.structuredContent.truncated, true);
  assert.equal(result.structuredContent.tickets[0].id, 'A-101');
  assert.doesNotMatch(JSON.stringify(result), /email|PRIVATE-FIXTURE|B-201/);
  assert.equal((await call('list_tickets', {})).structuredContent.tickets.length, 1);
  assert.match(JSON.stringify(await call('get_ticket', { id: 'B-201' })), /NOT_FOUND/);
});
test('second identity receives only its own tenant', async t => {
  const { call } = await service(t, { tenant: 'beta' });
  const result = await call('list_tickets', { status: 'all' });
  assert.deepEqual(result.structuredContent.tickets.map(row => row.id), ['B-201']);
});
test('rejects tenant impersonation, arbitrary URLs, excessive limit and mutation tool', async t => {
  const { call } = await service(t);
  for (const input of [{ tenant: 'beta' }, { url: 'https://example.invalid' }, { limit: 100 }]) {
    assert.match(JSON.stringify(await call('list_tickets', input)), /INVALID_INPUT/);
  }
  assert.match(JSON.stringify(await call('delete_ticket', { id: 'A-101' })), /UNKNOWN_TOOL/);
});
test('hostile note remains inert data, while logs omit input, output and credentials', async t => {
  const audit = [];
  const { call, fixture } = await service(t, { audit: event => audit.push(event) });
  const result = await call('get_ticket', { id: 'A-102' });
  assert.equal(result.structuredContent.trust, 'untrusted_record_data');
  assert.match(result.structuredContent.ticket.note, /Ignore all previous/);
  assert.deepEqual(Object.keys(audit[0]).sort(), ['outcome', 'requestId', 'tool']);
  assert.ok(!JSON.stringify(audit).includes(fixture.token));
  assert.doesNotMatch(JSON.stringify(audit), /A-102|credentials|example.invalid/);
});
for (const [mode, expected] of [['429', 'UPSTREAM_RATE_LIMIT_RETRY_LATER'], ['503', 'UPSTREAM_UNAVAILABLE'], ['timeout', 'UPSTREAM_READ_FAILED'], ['malformed', 'UPSTREAM_INVALID_RESPONSE']]) {
  test(`upstream ${mode} gives bounded sanitized failure`, async t => {
    const { call } = await service(t, { mode, timeout: 100 });
    const result = await call('list_tickets', {});
    assert.equal(result.isError, true);
    assert.match(JSON.stringify(result), new RegExp(expected));
  });
}
test('upstream rejects missing credentials and non-GET methods', async t => {
  const { fixture } = await service(t);
  assert.equal((await fetch(`${fixture.base}/tickets`)).status, 401);
  assert.equal((await fetch(`${fixture.base}/tickets`, { method: 'POST' })).status, 405);
  const call = makeService({ ...fixture, token: 'invalid', tenant: 'alpha' });
  assert.match(JSON.stringify(await call('list_tickets', {})), /UPSTREAM_AUTH_DENIED/);
});
test('local request limit resets after its time window', async t => {
  let clock = 0;
  const { call } = await service(t, { maxCalls: 1, now: () => clock });
  assert.ok((await call('list_tickets', {})).structuredContent);
  assert.match(JSON.stringify(await call('list_tickets', {})), /LOCAL_RATE_LIMIT/);
  clock = 60_000;
  assert.ok((await call('list_tickets', {})).structuredContent);
});
for (const [label, mode, expectedVersion] of [['legacy', 'legacy', '2025-11-25'], ['modern', { pin: '2026-07-28' }, '2026-07-28']]) {
test(`official SDK ${label} client discovers and invokes real stdio subprocess`, async t => {
  const client = new Client({ name: 'acceptance-test', version: '1.0.0' }, { versionNegotiation: { mode } });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../src/server.mjs', import.meta.url))], env: { DEMO_TENANT: 'alpha' }, stderr: 'pipe' });
  let logs = ''; transport.stderr?.on('data', chunk => { logs += chunk; });
  t.after(async () => { await client.close(); });
  await client.connect(transport);
  assert.equal(client.getNegotiatedProtocolVersion(), expectedVersion);
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map(tool => tool.name).sort(), ['get_ticket', 'list_tickets']);
  const result = await client.callTool({ name: 'get_ticket', arguments: { id: 'A-101' } });
  assert.equal(result.structuredContent.ticket.id, 'A-101');
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE-FIXTURE|email/);
  const denied = await client.callTool({ name: 'get_ticket', arguments: { id: 'B-201' } });
  assert.equal(denied.isError, true);
  assert.doesNotMatch(logs, /PRIVATE-FIXTURE|Bearer/);
});
}

test('adapter enforces tenant scope even when upstream returns mixed tenants', async t => {
  const { call } = await service(t, { mode: 'mixed' });
  const result = await call('list_tickets', { status: 'all' });
  assert.deepEqual(result.structuredContent.tickets.map(row => row.id), ['A-101', 'A-102']);
  assert.match(JSON.stringify(await call('get_ticket', { id: 'B-201' })), /NOT_FOUND/);
});
test('oversized upstream response is rejected', async t => {
  const { call } = await service(t, { mode: 'oversized' });
  assert.match(JSON.stringify(await call('list_tickets', {})), /UPSTREAM_TOO_LARGE/);
});
test('operator endpoint rejects external hosts, credentials and URL extras', () => {
  for (const base of ['https://example.invalid', 'http://user:pass@127.0.0.1', 'http://127.0.0.1/path', 'http://127.0.0.1/?secret=x', 'http://127.0.0.1/#fragment']) {
    assert.throws(() => makeService({ base, token: 'synthetic', tenant: 'alpha' }), /local fixture/);
  }
});
