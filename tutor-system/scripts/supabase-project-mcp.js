#!/usr/bin/env node
// Purpose: call the project-scoped Supabase MCP using existing local credentials for release inspection and delivery.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

async function main() {
  const [project, tool, argumentFile] = process.argv.slice(2);
  if (!['ciubrzggdqesgvfkpolj', 'zgbufaxooqxeabewktzd'].includes(project) || !tool) {
    throw new Error('Usage: supabase-project-mcp.js <staging-or-production-ref> <tool> [arguments.json]');
  }
  const envPath = process.env.SUPABASE_MCP_ENV_FILE || path.resolve(__dirname, '../.env');
  const config = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};
  const token = process.env.SUPABASE_ACCESS_TOKEN || config.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required');
  const endpoint = 'https://mcp.supabase.com/mcp?project_ref=' + project;
  const headers = {
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  async function request(body) {
    const result = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!result.ok) throw new Error('Supabase MCP HTTP ' + result.status);
    return result;
  }
  const init = await request({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'platform-release', version: '1.0' } },
  });
  await init.text();
  const session = init.headers.get('mcp-session-id');
  if (!session) throw new Error('MCP initialization did not establish a session');
  headers['Mcp-Session-Id'] = session;
  await request({ jsonrpc: '2.0', method: 'notifications/initialized' });
  const response = await request({
    jsonrpc: '2.0', id: 2, method: tool === '--list' ? 'tools/list' : 'tools/call',
    params: tool === '--list' ? {} : { name: tool, arguments: argumentFile ? JSON.parse(fs.readFileSync(argumentFile, 'utf8')) : {} },
  });
  const result = await response.json();
  if (result.error || result.result?.isError) {
    process.stderr.write(JSON.stringify(result) + '\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write(JSON.stringify(result.result) + '\n');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
