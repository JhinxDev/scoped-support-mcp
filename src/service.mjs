import { randomUUID } from 'node:crypto';
import * as z from 'zod/v4';

export const listSchema = z.strictObject({ status: z.enum(['open', 'closed', 'all']).default('open'), limit: z.number().int().min(1).max(10).default(5) });
export const getSchema = z.strictObject({ id: z.string().regex(/^[AB]-\d{3}$/) });
const rowSchema = z.object({ id: z.string(), tenant: z.enum(['alpha', 'beta']), status: z.enum(['open', 'closed']), title: z.string().max(200), note: z.string().max(1000) });
const publicRow = ({ id, status, title, note }) => ({ id, status, title, note });

export function makeService({ base, token, tenant, audit = () => {}, timeout = 800, now = Date.now, maxCalls = 30 }) {
  // Demo deliberately disallows user-supplied upstream URLs and external hosts.
  const endpoint = new URL(base);
  if (endpoint.hostname !== '127.0.0.1' || endpoint.protocol !== 'http:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') throw new Error('Only the local fixture is supported');
  if (!['alpha', 'beta'].includes(tenant)) throw new Error('Unknown demo identity');
  let start = now(), calls = 0;
  return async function call(tool, input) {
    const requestId = randomUUID();
    const finish = (result, code) => { audit({ requestId, tool: ['list_tickets', 'get_ticket'].includes(tool) ? tool : 'unknown', outcome: code }); return result; };
    const failure = code => finish({ isError: true, content: [{ type: 'text', text: JSON.stringify({ error: code, requestId }) }] }, code);
    if (now() - start >= 60_000) { start = now(); calls = 0; }
    if (++calls > maxCalls) return failure('LOCAL_RATE_LIMIT');
    const schema = tool === 'list_tickets' ? listSchema : tool === 'get_ticket' ? getSchema : null;
    if (!schema) return failure('UNKNOWN_TOOL');
    const parsed = schema.safeParse(input);
    if (!parsed.success) return failure('INVALID_INPUT');
    let payload;
    try {
      const response = await fetch(new URL('/tickets', endpoint), { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(timeout), redirect: 'error' });
      if (!response.ok) await response.body?.cancel();
      if (response.status === 429) return failure('UPSTREAM_RATE_LIMIT_RETRY_LATER');
      if (response.status === 401 || response.status === 403) return failure('UPSTREAM_AUTH_DENIED');
      if (!response.ok) return failure('UPSTREAM_UNAVAILABLE');
      // Fixture is tiny. Bound body consumption as well as timeout for transport failures.
      const reader = response.body.getReader();
      let size = 0; const chunks = [];
      while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 16_384) { await reader.cancel(); return failure('UPSTREAM_TOO_LARGE'); } chunks.push(value); }
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { return failure('UPSTREAM_READ_FAILED'); }
    const valid = z.object({ tickets: z.array(rowSchema).max(100) }).safeParse(payload);
    if (!valid.success) return failure('UPSTREAM_INVALID_RESPONSE');
    const allowed = valid.data.tickets.filter(row => row.tenant === tenant);
    let data;
    if (tool === 'get_ticket') {
      const row = allowed.find(row => row.id === parsed.data.id);
      if (!row) return failure('NOT_FOUND'); // Same outcome for missing and inaccessible IDs.
      data = { ticket: publicRow(row) };
    } else {
      const matching = allowed.filter(row => parsed.data.status === 'all' || row.status === parsed.data.status);
      data = { tickets: matching.slice(0, parsed.data.limit).map(publicRow), truncated: matching.length > parsed.data.limit };
    }
    const result = { source: 'synthetic-support-api', trust: 'untrusted_record_data', ...data };
    return finish({ content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result }, 'OK');
  };
}
