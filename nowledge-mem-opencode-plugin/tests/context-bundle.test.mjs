import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import plugin from "../src/index.ts"

async function runContext(payload) {
  const root = mkdtempSync(join(tmpdir(), "nmem-context-contract-"))
  const argsPath = join(root, "args.jsonl")
  const executable = join(root, "nmem")
  writeFileSync(executable, `#!${process.execPath}\nimport fs from 'node:fs';\nfs.appendFileSync(process.env.NMEM_TEST_ARGS,JSON.stringify(process.argv.slice(2))+'\\n');\nprocess.stdout.write(process.env.NMEM_TEST_CONTEXT);\n`, { mode: 0o755 })
  const vars = { PATH: `${root}:${process.env.PATH}`, HOME: root, NMEM_TEST_ARGS: argsPath, NMEM_TEST_CONTEXT: payload,
    NMEM_AGENT_ID: undefined, NMEM_HOST_AGENT_ID: undefined, NMEM_SPACE: undefined, NMEM_SPACE_ID: undefined }
  const previous = Object.fromEntries(Object.keys(vars).map(key => [key, process.env[key]]))
  for (const [key,value] of Object.entries(vars)) value === undefined ? delete process.env[key] : process.env[key]=value
  try {
    const tools=[]
    const ctx={location:{directory:root,project:{id:"synthetic-context-project"}},options:{},
      tool:{transform: async cb=>{cb({add:tool=>tools.push(tool)});return {dispose:async()=>{}}}},
      session:{context:async()=>[],hook:async()=>({dispose:async()=>{}})},
      event:{subscribe:()=> (async function*(){})()}}
    const cleanup=await plugin.setup(ctx)
    try {
      const tool=tools.find(tool=>tool.name==="nowledge_mem_context_bundle")
      assert.ok(tool)
      const result=await tool.execute({space_id:"Case-A"})
      return {result,args:readFileSync(argsPath,"utf8").trim().split("\n").map(JSON.parse)}
    } finally {await cleanup()}
  } finally {
    for (const [key,value] of Object.entries(previous)) value===undefined ? delete process.env[key] : process.env[key]=value
    rmSync(root,{recursive:true,force:true})
  }
}

const full={owner_profile:{custom_instructions:"Keep owner instructions"},agent_profile:{instructions:"Keep agent instructions"},
  active_space:{primary_space_id:"Case-A"},rule_stack:{global:["Preserve configured rule"]},working_memory:{content:"Synthetic priority"},
  kfs_roots:{bundle:"/context/bundle.md"},compiled_hash:"same-semantic-hash",rendered_markdown:"Synthetic priority\nKeep owner instructions\nKeep agent instructions"}

test("registered Context tool removes only duplicate Markdown and retains exact CLI scope",async()=>{
  const {result,args}=await runContext(JSON.stringify(full))
  const value=JSON.parse(result.content)
  assert.equal(Object.hasOwn(value,"rendered_markdown"),false,"model receives the duplicated Markdown context")
  const {rendered_markdown,...expected}=full
  assert.deepEqual(value,expected)
  assert.equal(args.length,1)
  assert.deepEqual(args[0],["--json","context","--source-app","opencode","--space-id","Case-A"])
})

test("registered Context tool preserves already compact, Markdown-only and unknown payloads",async()=>{
  const {rendered_markdown,...compact}=full
  for (const value of [compact,{rendered_markdown:"Only available context"},{arbitrary:"Unknown response"},{owner_profile:full.owner_profile,active_space:full.active_space,compiled_hash:full.compiled_hash,rendered_markdown:"Only available context in a partial response"},[full]]) {
    const {result}=await runContext(JSON.stringify(value))
    assert.deepEqual(JSON.parse(result.content),value)
  }
  const {result}=await runContext("Plain legacy text")
  assert.equal(result.content,"Plain legacy text")
})
