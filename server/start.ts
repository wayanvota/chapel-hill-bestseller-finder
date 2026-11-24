import {createServer} from 'node:http';
import {api} from './api.ts';
const server=createServer((req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 const allowedOrigin=process.env.PUBLIC_ORIGIN;
 if(allowedOrigin&&req.headers.origin===allowedOrigin){
  res.setHeader('Access-Control-Allow-Origin',allowedOrigin);
  res.setHeader('Vary','Origin');
  if(req.method==='OPTIONS'){
   res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});res.end();return;
  }
 }else if(req.method==='OPTIONS'){
  res.writeHead(403);res.end();return;
 }
 if(req.url==='/healthz'&&req.method==='GET'){
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({status:'ok'}));return;
 }
 void api(req,res,()=>{res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Not found'}));});
});
server.requestTimeout=150000;
server.headersTimeout=15000;
server.listen(Number(process.env.PORT||4174),process.env.HOST||'0.0.0.0',()=>console.log('Bestseller API listening'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
