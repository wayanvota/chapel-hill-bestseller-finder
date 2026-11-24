"""Rebuild the persisted AI-assisted reading decisions. No network or LLM API calls."""
import json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1];p=ROOT/'data'/'subject-enrichment'
targets=list(json.loads((p/'targets.json').read_text()).items());summaries=json.loads((p/'summary-review.json').read_text());out={}
for line in (p/'description-decisions.tsv').read_text().splitlines():
 i,labels,why=line.split('|');id,b=targets[int(i)];source=summaries[id]['sourceUrl']
 out[id]={'title':b['title'],'author':b['author'],'subjects':labels.split(';'),'method':'public-description-review','evidence':{label:{'sourceUrl':source,'matchedTerms':[why]} for label in labels.split(';')},'reviewer':'AI-assisted semantic reading; not human-verified','sourceKind':'archived-public-summary','assignedOn':'2026-11-23'}
for line in (p/'external-decisions.tsv').read_text().splitlines():
 i,labels,source,why=line.split('|');id,b=targets[int(i)]
 out[id]={'title':b['title'],'author':b['author'],'subjects':labels.split(';'),'method':'public-description-review','evidence':{label:{'sourceUrl':source,'matchedTerms':[why]} for label in labels.split(';')},'reviewer':'AI-assisted semantic reading; not human-verified','sourceKind':'public-book-page','assignedOn':'2026-11-23'}
(p/'description-overrides.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('Persisted description decisions:',len(out))
