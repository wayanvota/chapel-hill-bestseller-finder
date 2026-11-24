import {subjectOptions} from './subjects.ts';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {listBooks,getBooks,coverage} from './store.ts';
import {googleBooksUrl,catalogSearchUrl} from './domain.ts';
import {checkBatch} from './rss.ts';
let busy=false;
function json(res:ServerResponse,status:number,data:unknown){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
export async function api(req:IncomingMessage,res:ServerResponse,next:()=>void){
 const url=new URL(req.url||'/','http://localhost');if(!url.pathname.startsWith('/api/'))return next();
 try{
 if(url.pathname==='/api/subjects'&&req.method==='GET')return json(res,200,{subjects:subjectOptions});
 if(url.pathname==='/api/books'&&req.method==='GET'){
 const list=url.searchParams.get('list')||'hardcover-nonfiction',start=url.searchParams.get('start')||'2023-11-22',end=url.searchParams.get('end')||'2026-11-22',subject=url.searchParams.get('subject')||'History',scope=url.searchParams.get('scope')||'reviewed';
 if(!['hardcover-nonfiction','hardcover-fiction'].includes(list)||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end)return json(res,400,{error:'Choose a valid list and date range.'});
 const books=listBooks(list,start,end,subject,scope).map(b=>({...b,googleBooksUrl:googleBooksUrl(b),searchUrl:catalogSearchUrl(b)}));return json(res,200,{books,coverage:coverage(list,start,end)});
 }
 if(url.pathname==='/api/availability'&&req.method==='POST'){
 if(req.headers.origin&&req.headers.origin!==process.env.PUBLIC_ORIGIN&&new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:'Same-origin requests only'});
 if(process.env.RSS_ENABLED==='false')return json(res,503,{error:'Live catalog checks are disabled. Open the library links instead.'});
 if(busy)return json(res,429,{error:'Another catalog check is running. Please try again shortly.'});
 let body='';for await(const chunk of req){body+=chunk;if(body.length>10000)return json(res,413,{error:'Request too large'});}
 const ids=JSON.parse(body).ids;if(!Array.isArray(ids)||!ids.length||ids.length>45||ids.some(x=>typeof x!=='string'))return json(res,400,{error:'Choose 1–45 titles per check'});
 const books=getBooks([...new Set(ids)]);if(books.length!==new Set(ids).size)return json(res,400,{error:'Unknown book'});
 if(busy)return json(res,429,{error:'Another catalog check is running. Please try again shortly.'});
 busy=true;res.writeHead(200,{'Content-Type':'application/x-ndjson','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});let closed=false;res.on('close',()=>{closed=true;});
 try{for(let i=0;i<books.length&&!closed;i+=3){const observations=await checkBatch(books.slice(i,i+3));if(!closed)res.write(JSON.stringify({observations})+'\n');if(i+3<books.length)await new Promise(r=>setTimeout(r,300));}if(!closed)res.end();}finally{busy=false;}return;
 }
 return json(res,404,{error:'Not found'});
 }catch{if(!res.headersSent)json(res,500,{error:'The request could not be completed.'});else res.end();}
}
