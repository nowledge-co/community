import { once } from 'node:events'
import { createServer } from 'node:http'
import { createMcpHandler, McpServer, ResourceTemplate } from '@modelcontextprotocol/server'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { z } from 'zod'

export async function listen(t, server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
    server.closeAllConnections()
  }))
  return `http://127.0.0.1:${server.address().port}`
}

export async function startMcpFixture(t, options = {}) {
  const state = { mode: options.mode ?? 'healthy', dropToolCall: options.dropToolCall ?? false, dropped: 0, calls: [], requests: [] }
  const handler = createMcpHandler(() => {
    const server = new McpServer({ name: 'nowledge-mem-fixture', version: '1.0.0' })
    server.registerTool('ping', { description: 'Read a synthetic memory marker.', inputSchema: z.object({}) }, async () => {
      state.calls.push('ping')
      return {
        ...(options.rejectToolCalls ? { isError: true } : {}),
        content: [{ type: 'text', text: options.rejectToolCalls ? 'Synthetic memory failure.' : 'Synthetic memory pong.' }],
      }
    })
    server.registerResource('memo', 'memo://fixture', { mimeType: 'text/plain' }, async uri => {
      state.calls.push('resources/read')
      return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'Synthetic resource memory.' }] }
    })
    server.registerResource('named-memo', new ResourceTemplate('memo://fixture/{name}', { list: undefined }), { mimeType: 'text/plain' }, async uri => ({
      contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'Synthetic named memory.' }],
    }))
    return server
  })
  const http = createServer((request, response) => {
    state.requests.push({ time: performance.now(), headers: request.headers })
    if (request.headers.authorization !== 'Bearer synthetic-required-key' || request.headers['x-nmem-api-key'] !== 'synthetic-required-key') {
      response.writeHead(401).end('Fixture authentication required.')
      return
    }
    if (state.mode === 'stall') return
    const handle = toNodeHandler({
      async fetch(input, context) {
        if (state.dropToolCall && input.method === 'POST') {
          const body = await input.clone().json()
          if (body.method === 'tools/call') {
            state.dropToolCall = false
            state.dropped++
            response.destroy()
            return new Response(null, { status: 503 })
          }
        }
        return handler.fetch(input, context)
      },
    })
    void handle(request, response).catch(() => {
      if (!response.destroyed) response.writeHead(500).end('Fixture request failed.')
    })
  })
  const baseURL = await listen(t, http)
  t.after(() => handler.close())
  return { url: `${baseURL}/mcp`, state }
}

/** Hold a model response until an observable host lifecycle barrier settles. */
export async function gateModel(t, baseURL, beforeFirstRequest) {
  let first = true
  const server = createServer((request, response) => {
    void (async () => {
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      if (first) { first = false; await beforeFirstRequest() }
      const upstream = await fetch(new URL(request.url, baseURL), {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: Buffer.concat(chunks),
        signal: AbortSignal.timeout(30_000),
      })
      const body = await upstream.text()
      response.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') }).end(body)
    })().catch(error => {
      if (!response.destroyed) response.writeHead(500).end(error.message)
    })
  })
  return listen(t, server)
}
