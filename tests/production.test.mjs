import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('production API serves archive, rejects foreign origins, and hides local files', async()=>{
 const child=spawn(process.execPath,['server/start.ts'],{env:{...process.env,HOST:'127.0.0.1',PORT:'4199',PUBLIC_ORIGIN:'https://wayan.com',RSS_ENABLED:'false'},stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('API exited before listening');})]);
  const base='http://127.0.0.1:4199';
  assert.equal((await fetch(base+'/healthz')).status,200);
  const result=await (await fetch(base+'/api/books?list=hardcover-fiction&start=2021-11-23&end=2026-11-23&subject=Science%20Fiction&scope=all')).json();
  assert.equal(result.books.length,37);assert.equal(result.coverage.imported,261);
  assert.ok(result.books.every(b=>b.subjects.includes('Science Fiction')));
  assert.equal((await fetch(base+'/data/seed.json')).status,404);
  const post=origin=>fetch(base+'/api/availability',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({ids:[result.books[0].id]})});
  assert.equal((await post('https://foreign.example')).status,403);
  assert.equal((await post('https://wayan.com')).status,503);
 }finally{child.kill('SIGTERM');await once(child,'exit');}
});
