import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { NowledgeMemClient } from "../src/client.js";
const logger={info(){},warn(){},debug(){},error(){}};
async function listen(t,handler){
	const server=createServer(handler);
	await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
	t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
	return `http://127.0.0.1:${server.address().port}`;
}
for(const status of [302,307,308])for(const route of ["transcript","roster"]){
	test(`${status} ${route} redirect cannot forward credentials or transcript to another origin`,async(t)=>{
		const received=[];
		const destination=await listen(t,async(req,res)=>{
			let body="";for await(const chunk of req)body+=chunk;
			received.push({headers:req.headers,body});
			res.setHeader("content-type","application/json");
			res.end(JSON.stringify({success:true,spaces:[{id:"work",name:"Work"}]}));
		});
		const origin=await listen(t,(req,res)=>{res.writeHead(status,{location:destination+"/receive"});res.end();});
		const client=new NowledgeMemClient(logger,{}, {apiUrl:origin,apiKey:"synthetic-only",...(route==="roster"?{space:"Work"}:{})});
		await client.apiJson("POST","/threads/import",{messages:[{role:"user",content:"Synthetic private transcript"}]}).catch(()=>{});
		assert.deepEqual(received,[],"a redirect must never receive the secret or transcript");
	});
}
