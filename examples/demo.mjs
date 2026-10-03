import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';
const client = new Client({ name: 'portfolio-demo', version: '1.0.0' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } });
const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../src/server.mjs', import.meta.url))], env: { DEMO_TENANT: 'alpha' }, stderr: 'pipe' });
transport.stderr?.on('data', () => {});
try {
  await client.connect(transport);
  console.log('Synthetic support lookup. No model, paid API or customer data.');
  console.log('Negotiated protocol:', client.getNegotiatedProtocolVersion());
  console.log('Available tools:', (await client.listTools()).tools.map(tool => tool.name).join(', '));
  for (const [name, args] of [['list_tickets', { status: 'open' }], ['get_ticket', { id: 'B-201' }], ['get_ticket', { id: 'A-102' }]]) {
    const result = await client.callTool({ name, arguments: args });
    console.log(JSON.stringify({ request: { name, arguments: args }, result }, null, 2));
  }
} finally { await client.close(); }
