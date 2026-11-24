import {withSubjects,matchesSubject} from './subjects.ts';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalize,chooseAppearances,type Book} from './domain.ts';
const data=new URL('../data/',import.meta.url);mkdirSync(data,{recursive:true});
export const seed:Book[]=JSON.parse(readFileSync(new URL('seed.json',data),'utf8'));
const db=new DatabaseSync(fileURLToPath(new URL('catalog.sqlite',data)));
db.exec(`PRAGMA journal_mode=WAL;CREATE TABLE IF NOT EXISTS work(id TEXT PRIMARY KEY,title TEXT,author TEXT,subject TEXT,category TEXT);CREATE TABLE IF NOT EXISTS edition(id TEXT PRIMARY KEY,workId TEXT,catalogUrl TEXT,callNumber TEXT);CREATE TABLE IF NOT EXISTS appearance(workId TEXT,list TEXT,date TEXT,rank INTEGER,source TEXT,PRIMARY KEY(workId,list,date));CREATE TABLE IF NOT EXISTS issue(list TEXT,date TEXT,status TEXT,source TEXT,PRIMARY KEY(list,date));`);
const putWork=db.prepare('INSERT INTO work VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,author=excluded.author,subject=excluded.subject,category=excluded.category');
const putEdition=db.prepare('INSERT OR REPLACE INTO edition VALUES(?,?,?,?)');
const putAppearance=db.prepare('INSERT OR REPLACE INTO appearance VALUES(?,?,?,?,?)');
const putIssue=db.prepare('INSERT OR REPLACE INTO issue VALUES(?,?,?,?)');
const key=(t:string,a:string)=>normalize(t.split(':')[0])+'|'+normalize(a.split(/\s+(?:with|and)\s+/i)[0]);
const reviewed=new Map(seed.map(b=>[key(b.title,b.author),b]));
for(const b of seed){putWork.run(b.id,b.title,b.author,b.subject,b.category);putEdition.run(b.id,b.id,b.catalogUrl!,b.callNumber!);putAppearance.run(b.id,b.list,b.listDate,b.rank,b.evidenceUrl);}
let history:any={start:'2021-11-22',end:'2026-11-22',issues:[]};
const manifest=new URL('history/manifest.json',data),archive=new URL('history/appearances.json',data);
if(existsSync(manifest)&&existsSync(archive)){
 history=JSON.parse(readFileSync(manifest,'utf8'));
 db.exec('BEGIN');
 for(const a of JSON.parse(readFileSync(archive,'utf8'))){
 const known=reviewed.get(key(a.title,a.author));const id=known?.id||'archive-'+createHash('sha256').update(key(a.title,a.author)).digest('hex').slice(0,20);
 if(!known)putWork.run(id,a.title,a.author,'Unclassified','Unclassified');
 putAppearance.run(id,a.list,a.publishedDate,a.rank,a.sourceUrl);
 }
 for(const issue of history.issues)for(const list of ['hardcover-fiction','hardcover-nonfiction'])putIssue.run(list,issue.date,issue.status,issue.url);
 db.exec('COMMIT');
}
export function listBooks(list:string,start:string,end:string,subject:string,scope:string){
 const rows=db.prepare(`SELECT w.id,w.title,w.author,w.subject,w.category,e.callNumber,e.catalogUrl,a.rank,a.date AS listDate,a.source AS evidenceUrl,a.list FROM work w JOIN appearance a ON a.workId=w.id LEFT JOIN edition e ON e.workId=w.id WHERE a.list=? AND a.date>=? AND a.date<=? AND (?='all' OR e.id IS NOT NULL)`).all(list,start,end,scope) as unknown as Book[];
 return chooseAppearances(rows.map(withSubjects).filter(b=>matchesSubject(b,subject)));
}
export function getBooks(ids:string[]){return ids.map(id=>db.prepare(`SELECT w.*,e.callNumber,e.catalogUrl FROM work w LEFT JOIN edition e ON e.workId=w.id WHERE w.id=?`).get(id) as unknown as Book).filter(Boolean);}
export function coverage(list:string,start:string,end:string){
 const rows=db.prepare('SELECT date,status FROM issue WHERE list=? AND date>=? AND date<=?').all(list,start,end);
 const expected:string[]=[];const d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+(7-d.getUTCDay())%7);while(d.toISOString().slice(0,10)<=end){expected.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+7);}
 const imported=new Set(rows.filter(x=>x.status==='imported').map(x=>x.date));
 return {imported:imported.size,expected:expected.length,missing:expected.filter(d=>!imported.has(d)),complete:expected.length>0&&expected.every(d=>imported.has(d)),source:'Hawes archive',archiveStart:history.start,archiveEnd:history.end,totalIssues:history.issues.filter((x:any)=>x.status==='imported').length};
}
