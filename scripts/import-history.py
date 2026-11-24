"""Resumable local import of Hawes' two hardcover lists. No descriptions copied into data."""
import urllib.request,urllib.parse,datetime,json,re,hashlib,pathlib,subprocess,time
from html.parser import HTMLParser
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'data'/'history';OUT.mkdir(parents=True,exist_ok=True)
START=datetime.date(2021,11,22);END=datetime.date(2026,11,22)
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[]
 def handle_starttag(self,t,a):
  if t=='a': self.links.append(dict(a).get('href',''))
def get(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Bestseller-Finder-Local-Archive/0.1'}),timeout=20) as r:
  return r.read()
def parse(text,date):
 results=[]
 for idx,kind in enumerate(['hardcover-fiction','hardcover-nonfiction']):
  pages=text.split('\f');page=pages[idx] if len(pages)>idx else ''
  label='Non-Fiction' if idx else 'Fiction'
  if label.lower() not in page[:500].lower():raise ValueError('list heading missing')
  header_date=datetime.datetime.strptime(re.search(r'([A-Z][a-z]+\s+\d{1,2},\s+\d{4})',page[:600]).group(1),'%B %d, %Y').date().isoformat()
  if header_date!=date:raise ValueError('publication date mismatch')
  # A row begins with rank and ends with last-week/weeks-on-list columns.
  chunks=re.split(r'^\s*(\d{1,2})\s{2,}',page,flags=re.M)
  ranks=[]
  for i in range(1,len(chunks),2):
   rank=int(chunks[i]);lines=chunks[i+1].splitlines();clean=[]
   for line in lines:
    line=re.sub(r'\s{2,}(?:\d+|--|—|–|-|\*)\s+\d+\s*$','',line).strip()
    clean.append(line)
   body=' '.join(clean)
   m=re.match(r'(.+?)(?:,\s*|\.\s*|\s+)(?:by|edited by)\s+(.+?)[.,]?\s*\(',body)
   if not m and date=='2022-06-05' and idx==0 and rank==15:
    m=re.match(r'(THE LOST SUMMERS OF NEWPORT), (Beatriz Williams, Lauren Willig and Karen White)\. \(',body)
   if not m:raise ValueError('unparsed row '+str(rank))
   title,author=m.groups();ranks.append(rank)
   results.append({'list':kind,'publishedDate':date,'rank':rank,'title':title,'author':author,'sourceUrl':f'https://hawes.com/{date[:4]}/{date}.pdf'})
  if ranks!=list(range(1,16)):raise ValueError('rank sequence '+str(ranks))
 return results
urls={}
for year in range(2021,2027):
 url=f'https://hawes.com/{year}/{year}.htm';index=OUT/f'index-{year}.html';data=index.read_bytes() if index.exists() else get(url);index.write_bytes(data)
 p=Links();p.feed(data.decode(errors='replace'))
 for link in p.links:
  target=urllib.parse.urljoin(url,link);m=re.search(r'/(\d{4}-\d{2}-\d{2})\.pdf$',target)
  if m and START<=datetime.date.fromisoformat(m[1])<=END:urls[m[1]]=target
manifest=[];appearances=[]
for n,(date,url) in enumerate(sorted(urls.items())):
 pdf=OUT/(date+'.pdf');txt=OUT/(date+'.txt')
 rec={'date':date,'url':url,'status':'failed'}
 try:
  if not pdf.exists():
   data=get(url)
   if not data.startswith(b'%PDF'):raise ValueError('not PDF')
   pdf.write_bytes(data);time.sleep(.3)
  subprocess.run(['pdftotext','-layout',str(pdf),str(txt)],check=True,capture_output=True)
  parsed=parse(txt.read_text(),date);appearances.extend(parsed)
  rec.update(status='imported',rows=len(parsed),sha256=hashlib.sha256(pdf.read_bytes()).hexdigest())
 except Exception as e:rec['error']=str(e)
 manifest.append(rec)
 (OUT/'manifest.json').write_text(json.dumps({'start':str(START),'end':str(END),'source':'Hawes Publications, secondary transcription of NYT hardcover lists','issues':manifest},indent=2))
 (OUT/'appearances.json').write_text(json.dumps(appearances,indent=2))
 if n%20==0:print(n+1,len(urls),'imported',sum(x['status']=='imported' for x in manifest),'failed',sum(x['status']!='imported' for x in manifest),flush=True)
print('DONE',len(manifest),'issues',len(appearances),'appearances',flush=True)
