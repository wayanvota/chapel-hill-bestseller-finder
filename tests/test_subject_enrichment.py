import unittest,importlib.util,pathlib,json
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('enrich',ROOT/'scripts/enrich-subjects.py');enrich=importlib.util.module_from_spec(spec);spec.loader.exec_module(enrich)
class EnrichmentTests(unittest.TestCase):
 def test_identity_requires_title_and_author(self):
  b={'title':'THE WISH','author':'Nicholas Sparks'}
  self.assertTrue(enrich.matches(b,{'title':'The Wish','author_name':['Nicholas Sparks']}))
  self.assertFalse(enrich.matches(b,{'title':'The Wish','author_name':['Another Author']}))
  self.assertFalse(enrich.matches(b,{'title':'The Last Wish','author_name':['Nicholas Sparks']}))
 def test_franchise_prefix_is_not_identity(self):
  b={'title':'STAR WARS: THE FALLEN STAR','author':'Claudia Gray'}
  self.assertFalse(enrich.matches(b,{'title':'Star Wars: Lost Stars','author_name':['Claudia Gray']}))
  self.assertTrue(enrich.matches(b,{'title':'Star Wars: The Fallen Star','author_name':['Claudia Gray']}))
 def test_social_science_is_not_natural_science(self):
  self.assertNotIn('Science & Nature',enrich.classify_subjects(['Political science','Social science'],False))
  self.assertIn('Science Fiction',enrich.classify_subjects(['Fiction / Science Fiction / Hard Science Fiction'],True))
 def test_all_548_have_specific_sourced_assignments(self):
  targets=json.loads((ROOT/'data/subject-enrichment/targets.json').read_text());books=json.loads((ROOT/'data/subjects.json').read_text())['books']
  self.assertEqual(len(targets),548)
  for id in targets:
   b=books[id];self.assertTrue(b['subjects']);self.assertNotIn('General Fiction',b['subjects']);self.assertNotIn('General Nonfiction',b['subjects'])
   self.assertIn(b['method'],['public-catalog-subjects','public-description-review'])
   for label in b['subjects']:
    e=b['evidence'][label];self.assertTrue(e['sourceUrl'].startswith('https://'));self.assertTrue(e['matchedTerms'])
   if b['method']=='public-catalog-subjects':
    self.assertTrue(b['matchedRecords'])
    for d in b['matchedRecords']:self.assertTrue(enrich.matches(b,{'title':d['title'],'author_name':d['authors']}))
if __name__=='__main__':unittest.main()
