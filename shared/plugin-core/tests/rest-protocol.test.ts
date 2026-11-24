import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { repositoryRoot } from "../scripts/consumers.ts";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

for (const host of ["openclaw", "alma"]) {
  test(`${host}: real HTTP create and append acknowledge exact protocol and resolve the configured name`, async () => {
    const writes: {path: string; body: any}[] = [];
    const server = createServer(async (req, res) => {
      res.setHeader("content-type", "application/json");
      if (req.headers["x-nmem-space-protocol"] !== "exact-v1") {
        res.writeHead(409); res.end(JSON.stringify({error_code:"space_client_upgrade_required"})); return;
      }
      if (req.url === "/spaces") {
        res.end(JSON.stringify({spaces: [{id:" 项目/ID ", name:"Work"}]})); return;
      }
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      writes.push({path: req.url!, body});
      if (body.space_id !== " 项目/ID ") { res.writeHead(400); res.end("{}"); return; }
      res.end(JSON.stringify({success:true}));
    });
    await new Promise<void>(resolve => server.listen(0,"127.0.0.1",resolve));
    try {
      const address = server.address() as {port:number};
      const file = host === "alma" ? "main.js" : "src/client.js";
      const mod = await import(pathToFileURL(join(repositoryRoot, `nowledge-mem-${host}-plugin`, file)).href);
      const credentials = {apiUrl:`http://127.0.0.1:${address.port}`, space:"Work"};
      const logger = {debug(){},info(){},warn(){},error(){}};
      const client = host === "alma" ? new mod.NowledgeMemClient(logger,credentials) : new mod.NowledgeMemClient(logger,{},credentials);
      for (const path of ["/threads", "/threads/probe/append"]) {
        const body = {messages:[{role:"user",content:"synthetic"}]};
        if (host === "alma") await client._fetch("POST",path,{body});
        else await client.apiJson("POST",path,body);
      }
      assert.equal(writes.length,2);
      assert.equal(writes[0]!.body.space_id," 项目/ID ");
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });
}
