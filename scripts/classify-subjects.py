"""Assign transparent, deterministic subject suggestions from cached archive summaries."""
import json,re,unicodedata,hashlib,pathlib,collections
ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
def norm(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
def key(t,a):return norm(t.split(':')[0])+'|'+norm(re.split(r'\s+(?:with|and)\s+',a,flags=re.I)[0])
# Match whole words, not fragments (e.g. "war" must not match "award").
RULES={
 'History':r'histor(?:y|ian|ical)|centur(?:y|ies)|civil war|world war|revolutionary war|colonial|slavery|enslaved|holocaust|ancient|medieval|renaissance|reconstruction|founding fathers|american revolution|d-day|nazi|soviet|great depression',
 'Biography & Memoir':r'memoir|autobiograph\w*|biograph\w*|life story|life of|her life|his life|their lives|recounts|recollections|growing up|childhood|personal essays',
 'Politics & Society':r'politic\w*|presiden\w*|democra\w*|republican\w*|government|election\w*|congress\w*|supreme court|social justice|racism|racist|civil rights|inequality|immigration|feminism|feminist|capitalism|white house|geopolitic\w*|social issues',
 'Science & Nature':r'scien\w*|biology|biologist|physics|physicist\w*|astronom\w*|cosmos|cosmology|biological evolution|neuroscien\w*|climate|environment\w*|ecolog\w*|natural world|animal\w*|wildlife|botan\w*|ocean\w*|planetarium|planetary science',
 'Health & Psychology':r'health|medical|medicine|physician|doctor|disease\w*|cancer|trauma|mental|psycholog\w*|therap\w*|addiction|anxiety|depression|grief|brain|nutrition|diet|aging|longevity',
 'Business & Technology':r'business|entrepreneur\w*|econom\w*|financ\w*|invest\w*|corporat\w*|technolog\w*|artificial intelligence|silicon valley|billionaire\w*|company|companies|money|wealth|cryptocurrency',
 'Personal Growth & Relationships':r'self.help|self.improvement|habit\w*|happiness|mindfulness|motivat\w*|life lessons|advice|guide to|strategies|relationships|parenting|parenthood|fulfillment|purpose|productivity',
 'Religion & Spirituality':r'religio\w*|spiritual\w*|christian\w*|christ|god|jesus|bible|biblical|faith|prayer|buddhis\w*|judaism|islam|church|theolog\w*',
 'Arts & Culture':r'art(?:ist|ists|istic)?|music\w*|musician\w*|actor|actress|singer|song\w*|film\w*|hollywood|cinema\w*|comedi\w*|comedy|poet\w*|literatur\w*|fashion|style|stylist|television|cultural|culture',
 'Sports & Adventure':r'sport\w*|athlet\w*|basketball|football|baseball|tennis|golf|olympic\w*|soccer|hockey|mountaineer\w*|expedition|adventure|travel\w*|voyage|sailing|wilderness',
 'True Crime':r'true crime|murder\w*|serial killer|homicide|criminal|crime|fraud|scam|heist',
 'Mystery & Suspense':r'murder\w*|mystery|detective\w*|investigat\w*|killer|crime|criminal|missing|disappear\w*|thriller|suspense|spy|spies|espionage|cia|c\.i\.a\.|f\.b\.i\.|conspiracy|reacher|bosch',
 'Romance':r'romance|romantic|fall(?:s|ing)? in love|love story|lovers|love affair|second.chance|relationship|ex.boyfriend|ex.girlfriend|fake dating|pursuit of love|wedding|marriage|marry',
 'Fantasy':r'fantasy|magic\w*|dragon\w*|fae|fairy|fairies|witch\w*|wizard\w*|sorcer\w*|vampire\w*|supernatural|enchanted|gods|goddess\w*',
 'Science Fiction':r'science fiction|spacecraft|spaceship|space station|interstellar|astronaut\w*|alien\w*|time travel|goes back in time|dystopi\w*|post.apocalyptic|parallel universe|alternate realit\w*',
 'Historical Fiction':r'century|civil war|world war|1920s|1930s|1940s|1800s|19th|18th|16th|17th|nazi|great depression|during the depression|historical|ancient|medieval|renaissance|slavery|enslaved|vietnam war',
 'Horror':r'horror|haunt\w*|ghost\w*|terrifying|demonic|evil spirit|dark energy|nightmar\w*|vampire\w*|zombie\w*'
}
NONFICTION=list(RULES)[:11];FICTION=list(RULES)[11:]
EXTRA={
 'History':r'histories|historical account|dynasty|watergate|warfare|battle|military|revolution',
 'Biography & Memoir':r'personal and professional|her experiences|his experiences|her career|his career|memories|reflects on|reminiscences|personal journey|her struggles|his struggles',
 'Politics & Society':r'social activism|race theory|legal system|legal analyst|attorney general|rights of|marxism|communism|watergate|activist|justice system|public policy',
 'Science & Nature':r'immune system|genetic|anthropolog\w*|scientific|mathemat\w*|chemistry|space|natural history',
 'Health & Psychology':r'nurs\w*|hospital\w*|immune|cognitive|emotional|emotions|wellness|healing',
 'Personal Growth & Relationships':r'inner voice|unlearning|rethinking|ethical|moral|philosoph\w*|wisdom|marriage|family life',
 'Arts & Culture':r'band|album|pianist|performer|emmy|behind.the.scenes|journalis\w*|news anchor|broadcaster|news host|anchor|creative|creativity|humor|literary|bookshop',
 'Mystery & Suspense':r'abduct\w*|suspect\w*|terror\w*|global threats|body count|found dead|hacker|covert|secret agent|underworld|stalk\w*|hostage|kidnap\w*|dead body|dangerous secrets',
 'Fantasy':r'curse|faustian|afterlife|realm|myth\w*|fairy tale|magician|multiple possibilities of the lives',
 'Science Fiction':r'galactic|star wars|space|futuristic|robot\w*|android\w*',
 'Historical Fiction':r'revolutionary war|in (?:17|18|19)\d{2}|the (?:17|18|19)\d0s',
 'Horror':r'evil forces|sinister|monstrous',
}
for label,pattern in EXTRA.items():RULES[label]+='|'+pattern
RULES['Family & Relationships']=r'family|families|mother|father|daughter|son|sister|brother|parent|children|friendship|friends|marriage|husband|wife|grief|love'
FICTION.append('Family & Relationships')
RULES['Poetry & Short Stories']=r'poems|poet|poetry|short stories|short story|novellas'
FICTION.append('Poetry & Short Stories')
RULES['Adventure & Survival']=r'adventure|surviv\w*|expedition|treasure|escape|stranded|shipwreck|voyage'
FICTION.append('Adventure & Survival')
def classify(text,fiction):
 hits={}
 text=re.sub(r'political scientist|social scientist|cognitive scientist|political climate|social climate', '', text, flags=re.I)
 for label in FICTION if fiction else NONFICTION:
  found=sorted(set(m.group(0).lower() for m in re.finditer(r'\b(?:'+RULES[label]+r')\b',text,re.I)))
  if found:hits[label]=found
 return hits

def build():
 appearances=json.loads((DATA/'history/appearances.json').read_text());seed=json.loads((DATA/'seed.json').read_text());reviewed={key(b['title'],b['author']):b for b in seed};rows={};pages={}
 for a in appearances:
  k=key(a['title'],a['author']);known=reviewed.get(k);id=known['id'] if known else 'archive-'+hashlib.sha256(k.encode()).hexdigest()[:20]
  date=a['publishedDate'];fiction=a['list']=='hardcover-fiction';page_key=(date,fiction)
  if page_key not in pages:
   text=(DATA/'history'/f'{date}.txt').read_text().split('\f')[0 if fiction else 1]
   chunks=re.split(r'^\s*(\d{1,2})\s{2,}',text,flags=re.M)
   pages[page_key]={int(chunks[i]):chunks[i+1] for i in range(1,len(chunks),2)}
  body=pages[page_key][a['rank']].split('Hawes Publications')[0]
  # Skip author and publisher so e.g. "Little, Brown" never drives a label.
  summary=body.split('.)',1)[-1]
  summary=' '.join(re.sub(r'\s{2,}(?:\d+|--|—|–|-|\*)\s+\d+\s*$','',line).strip() for line in summary.splitlines())
  hits=classify(summary,fiction)
  row=rows.setdefault(id,{'title':known['title'] if known else a['title'],'author':a['author'],'subjects':[],'method':'reviewed' if known else 'automatic-summary-rules-v1','evidence':{}})
  if known:row['subjects']=[known['subject']];continue
  for label,terms in hits.items():
   if label not in row['subjects']:row['subjects'].append(label)
   row['evidence'].setdefault(label,{'sourceUrl':a['sourceUrl'],'matchedTerms':terms})
  row['fallback']='General Fiction' if fiction else 'General Nonfiction'
 for b in seed:
  rows[b['id']]={'title':b['title'],'author':b['author'],'subjects':[b['subject']],'method':'reviewed','evidence':{}}
 for row in rows.values():
  if not row['subjects']:row['subjects']=[row.get('fallback','General Nonfiction')];row['method']='general-fallback'
  row.pop('fallback',None);row['subjects'].sort()
 # Enrichment is limited to the original fallback set; reviewed seed labels always win.
 for name in ['openlibrary-overrides.json','description-overrides.json']:
  file=DATA/'subject-enrichment'/name
  if file.exists():
   for id,entry in json.loads(file.read_text()).items():
    if id in rows and rows[id]['method']=='general-fallback' and entry.get('subjects') and entry.get('evidence'):
     rows[id]=entry
 out={'version':2,'description':'Automatic suggestions from cached Hawes summaries; original 41 labels preserved. General categories mean no specific rule matched. Not publisher or library classifications.','books':rows}
 (DATA/'subjects.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
 counts=collections.Counter(s for r in rows.values() for s in r['subjects']);print(json.dumps({'books':len(rows),'categories':dict(sorted(counts.items())),'methods':dict(collections.Counter(r['method'] for r in rows.values()))},indent=2))
if __name__=='__main__':build()
