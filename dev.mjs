// Local preview has no Gemini secret and never generates mock AI answers.
import http from 'node:http';
import worker from './dist/server/index.js';
import {database} from './tests/local-db.mjs';
const env={DB:database()};
http.createServer(async(req,res)=>{try{let chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const r=await worker.fetch(new Request('http://127.0.0.1:8776'+req.url,{method:req.method,headers:req.headers,...(body.length?{body}:{} )}),env);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(500);res.end('Preview error');}}).listen(8776,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:8776'));
