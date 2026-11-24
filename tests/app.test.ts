import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {makeQuery,chooseAppearances,dateRange,googleBooksUrl,type Book} from '../server/domain.ts';
import {parseFeed,matchFeed,checkBatch} from '../server/rss.ts';
const seed:Book[]=JSON.parse(readFileSync(new URL('../data/seed.json',import.meta.url),'utf8'));
const xml=(items:string)=>`<rss><channel><title>Search</title>${items}</channel></rss>`;
const item=(id=seed[0].id,format='BK')=>`<item><title>The Demon of Unrest</title><dc:creator>Larson, Erik</dc:creator><link>https://chpl.bibliocommons.com/v2/record/${id}</link><format>${format}</format></item>`;
test('41-row seed parity with all original cell values and hyperlinks',()=>{const data=JSON.parse(readFileSync(new URL('../data/source-sheet.json',import.meta.url),'utf8'));const rows=data.sheets[0].data[0].rowData.slice(1);assert.equal(seed.length,41);assert.equal(new Set(seed.map(b=>b.id)).size,41);for(let i=0;i<41;i++){const v=rows[i].values,b=seed[i];assert.equal(b.title,v[0].formattedValue);assert.equal(b.catalogUrl,v[0].hyperlink);assert.equal(b.callNumber,v[4].formattedValue);assert.equal(b.rank,Number(v[5].formattedValue));assert.equal(b.listDate,v[6].formattedValue);assert.equal(b.evidenceUrl,v[7].hyperlink);}});
test('ranking takes lowest rank then most recent date and deduplicates work',()=>{const b=seed[0];const rows=chooseAppearances([{...b,rank:4,listDate:'2025-01-01'},{...b,rank:1,listDate:'2024-01-01'},{...b,rank:1,listDate:'2024-02-01'}]);assert.equal(rows.length,1);assert.equal(rows[0].listDate,'2024-02-01');});
test('date range uses calendar boundary and custom full years',()=>{assert.deepEqual(dateRange('5','','','2026-11-22'),['2021-11-22','2026-11-22']);assert.deepEqual(dateRange('custom','2022','2023','2026-11-22'),['2022-01-01','2023-12-31']);});
test('query escapes special characters, requires paired author and bounded batch',()=>{const q=makeQuery([{...seed[0],title:'A "quote" (test)'}]);assert.ok(q.includes('\\"quote\\"'));assert.ok(q.includes('author:'));assert.ok(q.includes('formatcode:(BK)'));assert.throws(()=>makeQuery([]));assert.throws(()=>makeQuery([...seed.slice(0,4)]));});
test('exact reviewed edition gets the matching call number',()=>{const r=matchFeed([seed[0]],parseFeed(xml(item())),'2026-11-22T16:00:00Z')[0];assert.equal(r.status,'available');assert.equal(r.callNumber,seed[0].callNumber);});
test('alternate edition and audiobook cannot borrow reviewed call number',()=>{for(const entry of [item('S92C9999'),item(seed[0].id,'BOOK_CD')]){const r=matchFeed([seed[0]],parseFeed(xml(entry)),'now')[0];assert.equal(r.status,'unverified');assert.equal(r.callNumber,undefined);}});
test('empty feed remains unverified',()=>assert.equal(matchFeed([seed[0]],parseFeed(xml('')),'now')[0].status,'unverified'));
test('malformed XML, HTML, DTD, external links and truncation are rejected',()=>{for(const s of ['<rss>','<html>no</html>','<!DOCTYPE rss><rss/>',xml(item().replace('chpl.bibliocommons.com','evil.example')),xml(item().repeat(25))])assert.throws(()=>parseFeed(s));});
test('timeout and rate limit become unverified',async()=>{for(const fetcher of [async()=>{throw Error('timeout');},async()=>new Response('',{status:429})]){const r=await checkBatch([seed[0]],fetcher as typeof fetch);assert.equal(r[0].status,'unverified');}});
test('partial failure preserves successful separate batch',async()=>{const good=await checkBatch([seed[0]],(async()=>new Response(xml(item()))) as typeof fetch);const bad=await checkBatch([seed[1]],(async()=>new Response('',{status:503})) as typeof fetch);assert.equal(good[0].status,'available');assert.equal(bad[0].status,'unverified');});
test('Google Books links encode title and author without credentials',()=>{const u=new URL(googleBooksUrl(seed[0]));assert.equal(u.hostname,'books.google.com');assert.ok(u.searchParams.get('q')?.includes('Erik Larson'));assert.equal(u.searchParams.has('key'),false);});
test('five-year archive has every expected Sunday and exactly 15 ranks per list',()=>{const m=JSON.parse(readFileSync(new URL('../data/history/manifest.json',import.meta.url),'utf8'));const a=JSON.parse(readFileSync(new URL('../data/history/appearances.json',import.meta.url),'utf8'));assert.equal(m.issues.length,261);assert.ok(m.issues.every((i:any)=>i.status==='imported'));assert.equal(a.length,7830);let d=new Date('2021-11-28T12:00:00Z');for(const issue of m.issues){assert.equal(issue.date,d.toISOString().slice(0,10));for(const list of ['hardcover-fiction','hardcover-nonfiction'])assert.deepEqual(a.filter((x:any)=>x.publishedDate===issue.date&&x.list===list).map((x:any)=>x.rank),Array.from({length:15},(_,i)=>i+1));d.setUTCDate(d.getUTCDate()+7);}});

import {createHash} from 'node:crypto';
import {normalize} from '../server/domain.ts';
import {withSubjects,matchesSubject,subjectOptions} from '../server/subjects.ts';
const subjectData=JSON.parse(readFileSync(new URL('../data/subjects.json',import.meta.url),'utf8')).books;
test('every archive work has subject coverage with traceable automatic evidence',()=>{
 const key=(t:string,a:string)=>normalize(t.split(':')[0])+'|'+normalize(a.split(/\s+(?:with|and)\s+/i)[0]);
 const known=new Map(seed.map(b=>[key(b.title,b.author),b.id]));
 const rows=JSON.parse(readFileSync(new URL('../data/history/appearances.json',import.meta.url),'utf8'));
 for(const a of rows){const k=key(a.title,a.author),id=known.get(k)||'archive-'+createHash('sha256').update(k).digest('hex').slice(0,20);const entry=subjectData[id];assert.ok(entry,`missing ${a.title}`);assert.ok(entry.subjects.length);for(const s of entry.subjects){assert.ok(subjectOptions.includes(s));if(entry.method==='automatic-summary-rules-v1'){assert.ok(entry.evidence[s].matchedTerms.length);assert.match(entry.evidence[s].sourceUrl,/^https:\/\/hawes.com\/\d{4}\/\d{4}-\d{2}-\d{2}\.pdf$/);}}}
});
test('all 41 reviewed labels and edition details remain intact',()=>{for(const b of seed){const tagged=withSubjects(b);assert.deepEqual(tagged.subjects,[b.subject]);assert.equal(tagged.subjectMethod,'reviewed');assert.equal(tagged.catalogUrl,b.catalogUrl);assert.equal(tagged.callNumber,b.callNumber);}});
test('overlapping subjects match independently and general fallback does not imply History',()=>{const b={...seed[0],subjects:['History','Politics & Society']};assert.equal(matchesSubject(b,'History'),true);assert.equal(matchesSubject(b,'Politics & Society'),true);assert.equal(matchesSubject(b,'All subjects'),true);assert.equal(matchesSubject(b,'Romance'),false);assert.equal(matchesSubject({...b,subjects:['General Nonfiction']},'History'),false);});
test('subject examples separate literal science from fashion and entertainment metaphors',()=>{
 const records=Object.values(subjectData) as {title:string;subjects:string[]}[];
 const tags=(title:string)=>records.find(b=>b.title===title)!.subjects;
 assert.ok(tags('IMMUNE').includes('Science & Nature'));
 assert.ok(tags('THE MAID').includes('Mystery & Suspense'));
 for(const title of ['THE LOOK','MCU','THE MYTH OF NORMAL'])assert.ok(!tags(title).includes('Science & Nature'),title);
});
