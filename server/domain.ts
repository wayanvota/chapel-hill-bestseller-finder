export type Book={subjects?:string[];subjectMethod?:string;subjectEvidence?:Record<string,{sourceUrl:string;matchedTerms:string[]}>;id:string;title:string;author:string;subject:string;category:string;callNumber?:string;rank:number;listDate:string;evidenceUrl:string;catalogUrl?:string;list:string;sourceRow?:number;sourceDate?:string;sourceUrl?:string;reviewed?:boolean};
export type Observation={id:string;status:'available'|'unverified';checkedAt:string;catalogUrl?:string;callNumber?:string;reason?:string};
export const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function primaryAuthor(author:string){return author.split(/\s+(?:with|and)\s+/i)[0].trim();}
export function queryTitle(title:string){return title.split(':')[0].trim();}
export const escapeQuery=(s:string)=>s.replace(/([+\-&|!(){}\[\]^"~*?:\\])/g,'\\$1');
export function makeQuery(books:Book[]){if(!books.length||books.length>3)throw Error('Batch must contain 1–3 books');return '('+books.map(b=>`(title:("${escapeQuery(queryTitle(b.title))}") AND author:("${escapeQuery(primaryAuthor(b.author).split(' ').at(-1)!)}"))`).join(' OR ')+') avlocation:"Chapel Hill Public Library" formatcode:(BK)';}
export function googleBooksUrl(book:Book){return 'https://books.google.com/books?'+new URLSearchParams({q:`intitle:"${queryTitle(book.title)}" inauthor:"${primaryAuthor(book.author)}"`});}
export function catalogSearchUrl(book:Book){return 'https://chpl.bibliocommons.com/v2/search?'+new URLSearchParams({query:makeQuery([book]),searchType:'bl'});}
export function dateRange(period:string,from:string,to:string,today:string){if(period==='custom')return [from+'-01-01',to+'-12-31'];const d=new Date(today+'T12:00:00Z');d.setUTCFullYear(d.getUTCFullYear()-(period==='1'?1:period==='5'?5:3));return [d.toISOString().slice(0,10),today];}
export function chooseAppearances(rows:Book[]){const map=new Map<string,Book>();for(const b of rows){const p=map.get(b.id);if(!p||b.rank<p.rank||b.rank===p.rank&&b.listDate>p.listDate)map.set(b.id,b);}return [...map.values()].sort((a,b)=>a.rank-b.rank||b.listDate.localeCompare(a.listDate)||a.title.localeCompare(b.title));}
