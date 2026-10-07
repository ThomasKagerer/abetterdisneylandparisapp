#!/usr/bin/env python3
"""Compile reviewed, semantic UI translations and attributed Disney catalogue names."""
import json, re, unicodedata
from pathlib import Path
from urllib.parse import unquote
ROOT=Path(__file__).resolve().parent
LANGS=['fr','it','es','zh-Hans','ja','ko','ar','en']
def canonical(s):
 s=unquote(s).strip().removesuffix('-app').removesuffix('-ref')
 return ALIASES.get(s,s)
ALIASES={
 'indiana-jones-et-le-temple-du-peril':'indiana-jones-and-the-temple-of-peril',
 'le-chateau-de-la-belle-au-bois-dormant':'sleeping-beauty-castle','ratatouille-lattraction':'ratatouille-the-adventure','star-tours-l-aventure-continue':'star-tours-the-aventures-continue',
 'un-accueilheroique':'heroicwelcome','spectacle-nocturne':'nighttime-spectacular','envoutement-royal-castle-stage':'enchantment-royal-castle-stage','glamour-darling-cruella-denfer':'glamour-darling-cruella-de-vil','promenade-madame-de-tremaine-filles':'lady-tremaine-daughters-stroll','spectacle-le-roi-lion':'lion-king-show','the-lion-king-rhythms-of-the-pride-lands':'lion-king-show','pavillon-des-princesses':'princess-pavilion','personne-ne-fait-ca-comme-gaston':'nobody-does-it-like-gaston','programme-de-disney-performing-arts':'disney-performing-arts-programme','disney-performing-arts-programm':'disney-performing-arts-programme','rencontre-mysterieuse':'mysterious-meeting','rencontre-capitaine-crochet':'meet-n-greet-captain-hook','rencontre-daisy-donald':'meet-n-greet-daisy-donald','rencontre-jafar':'meet-n-greet-jafar','rencontre-avec-jessie-ou-ses-amis':'meet-n-greet-jessie-or-friends','rencontre-mickey':'meet-mickey','rencontre-avec-minnie-en-europe':'meet-n-greet-minnie-across-europe','rencontre-monsieur-jack':'meet-n-greet-jack-skellington','rencontre-stitch':'meet-n-greet-stitch','rencontre-tic-tac':'meet-n-greet-chip-dale','rencontre-reine-de-coeur':'meet-n-greet-queen-hearts-wonderland','rencontre-dr-facilier':'meet-dr-facilier','rencontre-personnage-toy-story':'meet-toy-story-character','rencontre-personnage-zootopie':'meet-character-zootropolis','rencontre-drole-squelette':'meet-n-greet-goofy-skeleton','show-micky-und-der-zauberer-old':'show-mickey-and-the-magician-old','spettacolo-topolino-e-il-mago-old':'show-mickey-and-the-magician-old','espectaculo-mickey-and-the-magician-old':'show-mickey-and-the-magician-old'}
def js(name,value):
 return "(function(root){'use strict';const value="+json.dumps(value,ensure_ascii=False,separators=(',',':'))+";root."+name+"=value;if(typeof module!=='undefined')module.exports=value;})(typeof globalThis!=='undefined'?globalThis:this);\n"

def build():
 messages=[]; seen=set()
 for file in sorted((ROOT/'localization').glob('messages*.tsv')):
  for line_no,line in enumerate(file.read_text().splitlines(),1):
   if not line.strip() or line.startswith('#'):continue
   columns=line.split('|')
   if len(columns)!=len(LANGS)+1:raise ValueError(f'{file}:{line_no}: expected source and eight translations, got {len(columns)}')
   if any(not x.strip() for x in columns):raise ValueError(f'{file}:{line_no}: empty translation')
   source,*translations=columns
   key=" ".join(unicodedata.normalize("NFKC",source).split()).casefold()
   if key in seen:raise ValueError(f"{file}:{line_no}: duplicate source {source}")
   seen.add(key)
   expected=set(re.findall(r'\{\d+\}',source))
   for lang,value in zip(LANGS,translations):
    if set(re.findall(r'\{\d+\}',value))!=expected:raise ValueError(f'{file}:{line_no}:{lang}: placeholders differ')
   messages.append([source,dict(zip(LANGS,translations))])
 manifest=json.loads((ROOT/'dist/manifest.webmanifest').read_text())
 descriptions=dict(messages)['Ride-Favoriten, kurze Wege und Live-Navigation in Disneyland Paris.']
 (ROOT/'dist/manifest-de.webmanifest').write_text(json.dumps({**manifest,'lang':'de','dir':'ltr','description':'Ride-Favoriten, kurze Wege und Live-Navigation in Disneyland Paris.'},ensure_ascii=False,separators=(',',':'))+'\n')
 for lang in LANGS:
  localized={**manifest,'lang':lang,'dir':'rtl' if lang=='ar' else 'ltr','description':descriptions[lang]}
  (ROOT/f'dist/manifest-{lang}.webmanifest').write_text(json.dumps(localized,ensure_ascii=False,separators=(',',':'))+'\n')
 (ROOT/'dist/i18n-messages.js').write_text(js('DisneyMessages',messages))
 park=json.loads((ROOT/'dist/park-data.json').read_text());rides=park['rides'];by_slug={canonical(r.get('officialUrl','').rsplit('/',1)[-1]):r['id'] for r in rides if r.get('officialUrl')};names={r['id']:{'fallback':r.get('officialName') or r['name'],'original':r['name'],'sourceUrl':r.get('officialUrl')} for r in rides}
 for file in sorted((ROOT/'sources').glob('official-names-*.json')):
  doc=json.loads(file.read_text())
  for row in doc['entries']:
   id=by_slug.get(canonical(row['url'].rsplit('/',1)[-1]))
   if not id:continue
   # An asterisk is a footnote marker, never part of an attraction name.
   names[id][doc['locale']]={'name':row['name'].replace('*','').strip(),'url':row['url'],'checkedAt':doc['checkedAt']}
 (ROOT/'dist/official-names.js').write_text(js('DisneyOfficialNames',names))
 print(f'{len(messages)} UI messages; '+', '.join(f'{l}: {sum(l in n for n in names.values())} official names' for l in ['de','fr','it','es']))
 print('No localized Disney page:',[(r['name'],r.get('officialUrl','')) for r in rides if not any(l in names[r['id']] for l in ['de','fr','it','es'])])
if __name__=='__main__':build()
