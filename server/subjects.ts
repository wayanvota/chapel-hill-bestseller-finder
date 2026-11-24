import {readFileSync} from 'node:fs';
import type {Book} from './domain.ts';
type Assignment={subjects:string[];method:string;evidence:Record<string,{sourceUrl:string;matchedTerms:string[]}>};
const assignments:Record<string,Assignment>=JSON.parse(readFileSync(new URL('../data/subjects.json',import.meta.url),'utf8')).books;
export const subjectOptions=[...new Set(Object.values(assignments).flatMap(a=>a.subjects))].sort();
export function withSubjects(book:Book):Book{
 const entry=assignments[book.id];
 return {...book,subjects:entry?.subjects||[book.subject],subjectMethod:entry?.method||'unclassified',subjectEvidence:entry?.evidence||{}};
}
export function matchesSubject(book:Book,subject:string){return subject==='All subjects'||book.subjects?.includes(subject)===true;}
