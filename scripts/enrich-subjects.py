"""Resumable, key-free batch metadata enrichment. Never uses author-only matches."""
import sys,pathlib,json,urllib.request,urllib.parse,time,re,importlib.util,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1];DATA=ROOT/'data';OUT=DATA/'subject-enrichment';OUT.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('base',ROOT/'scripts/classify-subjects.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)

def title_key(t):return base.norm(re.sub(r'^(the|a|an)\s+','',t.lower()).strip())
def author_key(a):return base.norm(re.split(r'\s+(?:with|and)\s+',a,flags=re.I)[0])
def matches(book,doc):
 return (title_key(book['title'])==title_key(doc['title']) or (':' not in book['title'] and title_key(book['title'])==title_key(doc['title'].split(':')[0]))) and any(author_key(book['author'])==author_key(a) for a in doc.get('author_name',[]))
def classify_subjects(subjects,fiction):
 evidence={}
 extra={'Science Fiction':r'science[ -]fiction|sci[ -]fi|space opera','Mystery & Suspense':r'mystery|mysteries|thriller|suspense|detective','Romance':r'romance|love stories','Historical Fiction':r'historical fiction|fiction.*historical','Literary Fiction':r'literary fiction|fiction.*literary','Poetry & Short Stories':r'poetry|short stories','Biography & Memoir':r'biography|autobiography|memoir|personal narratives','History':r'history|civilization|anthropology','Politics & Society':r'political science|sociology|social science|social conditions','Science & Nature':r'science|natural history|biology','Arts & Culture':r'art|music|literature|performing arts','Health & Psychology':r'psychology|health|medicine','Business & Technology':r'economics|business|finance|technology','Personal Growth & Relationships':r'self.help|philosophy|ethics','Food & Cooking':r'cooking|cookbook|food','Humor':r'humor|humour|humorous','Essays':r'essays'}
 for term in subjects:
  if term.lower().startswith(('nyt:','new york times','reading level')):continue
  # Subjects are discrete catalog headings, not prose. Preserve each heading that supports a label.
  labels=set(base.classify(term,fiction))
  for label,pat in extra.items():
   if label in ['Food & Cooking','Humor','Essays'] or label in (base.FICTION+['Literary Fiction'] if fiction else base.NONFICTION):
    if re.search(r'\b(?:'+pat+r')\b',term,re.I):labels.add(label)
  if re.search(r'social science|political science|computer science',term,re.I):labels.discard('Science & Nature')
  for label in labels:evidence.setdefault(label,[]).append(term)
 return evidence

def run():
 targets_file=OUT/'targets.json'
 if not targets_file.exists():targets_file.write_text(json.dumps({k:v for k,v in json.loads((DATA/'subjects.json').read_text())['books'].items() if v['method']=='general-fallback'},indent=2))
 targets=json.loads(targets_file.read_text());items=list(targets.items());overrides={};unresolved={}
 for n in range(0,len(items),10):
  batch=items[n:n+10];terms=[]
  for id,b in batch:
   title=b['title'].replace('"',' ').split(':')[0];author=re.split(r'\s+(?:with|and)\s+',b['author'],flags=re.I)[0].replace('"',' ')
   terms.append(f'(title:"{title}" AND author:"{author}")')
  q=' OR '.join(terms);docs=[];offset=0
  while True:
   params={'q':q,'fields':'key,title,author_name,subject','limit':100,'offset':offset};url='https://openlibrary.org/search.json?'+urllib.parse.urlencode(params);cache=OUT/(hashlib.sha256(url.encode()).hexdigest()+'.json')
   if cache.exists():data=json.loads(cache.read_text())
   elif '--offline' in sys.argv:
    data={'docs':[]};break
   else:
    try:
     with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'ChapelHillBestsellerFinder/0.1 local metadata research'}),timeout=45) as r:data=json.load(r)
     cache.write_text(json.dumps(data));time.sleep(1.1)
    except Exception as e:
     print('fetch failed',n,repr(e),flush=True);data={'docs':[],'error':str(e)};break
   docs+=data.get('docs',[])
   if offset+100>=data.get('numFound',0):break
   offset+=100
  for id,b in batch:
   accepted=[d for d in docs if matches(b,d)];evidence={}
   for d in accepted:
    for label,terms in classify_subjects(d.get('subject',[]),b['subjects']==['General Fiction']).items():
     evidence.setdefault(label,{'sourceUrl':'https://openlibrary.org'+d['key'],'matchedTerms':sorted(set(terms))})
   if evidence:overrides[id]={'title':b['title'],'author':b['author'],'subjects':sorted(evidence),'method':'public-catalog-subjects','evidence':evidence,'matchedRecords':[{'key':d['key'],'title':d['title'],'authors':d.get('author_name',[])} for d in accepted]}
   else:unresolved[id]={**b,'reason':'no-specific-subjects' if accepted else 'no-exact-title-author-match'}
  (OUT/'openlibrary-overrides.json').write_text(json.dumps(overrides,ensure_ascii=False,indent=2)+'\n');(OUT/'unresolved.json').write_text(json.dumps(unresolved,ensure_ascii=False,indent=2)+'\n')
  print(f'{min(n+10,len(items))}/{len(items)}: {len(overrides)} assigned, {len(unresolved)} unresolved',flush=True)
if __name__=='__main__':run()
