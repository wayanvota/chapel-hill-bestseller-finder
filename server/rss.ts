import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {makeQuery,normalize,primaryAuthor,queryTitle,type Book,type Observation} from './domain.ts';
export function parseFeed(xml:string){
 if(xml.length>2_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw Error('Invalid catalog feed');
 const data=new XMLParser({ignoreAttributes:false,parseTagValue:false}).parse(xml);
 if(!data.rss?.channel||data.rss.channel.title==null)throw Error('Unexpected catalog response');
 const raw=data.rss.channel.item;const items=raw?(Array.isArray(raw)?raw:[raw]):[];
 if(items.length>=25)throw Error('Catalog response may be truncated');
 return items.map((x:any)=>{let url:URL;try{url=new URL(x.link);}catch{throw Error('Invalid catalog link');}
 if(url.protocol!=='https:'||url.hostname!=='chpl.bibliocommons.com'||!/^\/v2\/record\/S92C\d+$/.test(url.pathname))throw Error('Unexpected catalog link');
 return {id:url.pathname.split('/').at(-1)!,title:String(x.title||''),author:String(x['dc:creator']||''),format:String(x.format||''),url:url.href};});
}
export function matchFeed(books:Book[],items:ReturnType<typeof parseFeed>,checkedAt:string):Observation[]{return books.map(book=>{
 const matches=items.filter(x=>x.format==='BK'&&(book.catalogUrl?x.id===book.id:normalize(queryTitle(x.title))===normalize(queryTitle(book.title))&&normalize(x.author).includes(normalize(primaryAuthor(book.author).split(' ').at(-1)!))));
 // Unreviewed matches require author first and last names; ambiguity stays unverified.
 const valid=matches.filter(x=>book.catalogUrl||primaryAuthor(book.author).split(' ').filter(t=>t.length>2).every(t=>normalize(x.author).includes(normalize(t))));
 if(valid.length!==1)return {id:book.id,status:'unverified',checkedAt,reason:valid.length>1?'Multiple editions need review':'No exact available print match confirmed'};
 return {id:book.id,status:'available',checkedAt,catalogUrl:valid[0].url,callNumber:book.catalogUrl?book.callNumber:undefined};
});}
export async function checkBatch(books:Book[],fetcher:typeof fetch=fetch):Promise<Observation[]>{
 try{
 const url='https://gateway.bibliocommons.com/v2/libraries/chpl/rss/search?'+new URLSearchParams({query:makeQuery(books),searchType:'bl',view:'grouped'});
 const response=await fetcher(url,{signal:AbortSignal.timeout(10000),headers:{'User-Agent':'Chapel-Hill-Bestseller-Finder/0.1 (local reader tool)','Accept':'application/rss+xml, application/xml, text/xml'}});
 if(!response.ok)throw Error(response.status===429?'Catalog rate limit reached':`Catalog returned ${response.status}`);
 return matchFeed(books,parseFeed(await response.text()),new Date().toISOString());
 }catch(e){return books.map(b=>({id:b.id,status:'unverified',checkedAt:new Date().toISOString(),reason:e instanceof Error?e.message:'Catalog check failed'}));}
}
