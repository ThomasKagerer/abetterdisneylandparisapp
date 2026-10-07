#!/usr/bin/env python3
"""Build a small, offline Disney fact guide from the captured public catalogue/pages.

No Disney HTML, tracking scripts or marketing copy are mirrored.
Factual, paraphrased fields and compact, attributed official photos are shipped.
Missing detail pages remain explicitly incomplete; absence never means permission.
"""
import json
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent


def disney_url(value):
    parsed = urlparse(value or '')
    return parsed.scheme == 'https' and parsed.hostname == 'www.disneylandparis.com'


def same_title(first, second):
    clean = lambda value: re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', value).lower())
    a, b = clean(first), clean(second)
    return bool(a and b) and (a in b or b in a or SequenceMatcher(None, a, b).ratio() >= .7)


def service_fact(text):
    text = text.lower().strip()
    if 'single rider' in text:
        return ('service', 'Single Rider vorhanden')
    if 'photopass' in text:
        return ('service', 'Disney PhotoPass')
    if 'audio description' in text:
        return ('access', 'Audiobeschreibung verfügbar')
    if 'little or no flash' in text:
        return ('access', 'Wenig oder keine Blitzlichteffekte laut Disney')
    if 'transfer' in text and ('wheelchair' in text or text == 'transfer required'):
        return ('access', 'Umsteigen aus dem Rollstuhl erforderlich')
    if 'wheelchair accessible' in text:
        return ('access', 'Zustieg mit Rollstuhl möglich')
    if 'walking ability' in text and 'stairs' in text:
        return ('access', 'Eigenständiges Gehen und Treppensteigen erforderlich')
    if 'dog' in text and ('guide' in text or 'assistance' in text):
        if any(word in text for word in ['not accepted', 'not allowed', 'not permitted']):
            return ('access', 'Assistenzhunde nicht zugelassen')
        if re.fullmatch(r'guide(?: dogs)? and assistance dogs (?:allowed|accepted)', text):
            return ('access', 'Assistenzhunde zugelassen')
        return None
    if 'pregnan' in text or 'expectant mother' in text:
        restricted = any(word in text for word in ['not advised', 'may not', 'should not', 'not suitable'])
        return ('access', 'Laut Disney für Schwangere nicht geeignet' if restricted else 'Laut Disney für Schwangere zugänglich')
    if 'difficulty standing' in text:
        return ('access', 'Laut Disney für Gäste mit Schwierigkeiten beim Stehen geeignet')
    if 'limb atrophy' in text:
        return ('access', 'Bei Gliedmaßenatrophie hängt der Zugang vom Einzelfall ab; Disney-Service fragen')
    if 'learning disability' in text:
        return ('access', 'Bei kognitiver Einschränkung, Autismus oder psychischer Erkrankung: Begleitung ab 15 Jahren erforderlich')
    if 'visually impaired' in text:
        return ('access', 'Laut Disney für sehbehinderte Gäste geeignet')
    if 'blind guests' in text:
        return ('access', 'Für blinde Gäste: Begleitung ab 15 Jahren erforderlich')
    if 'hearing impaired' in text:
        return ('access', 'Laut Disney für hörbehinderte Gäste geeignet')
    if 'debilitating illness' in text:
        return ('access', 'Disney nennt Zugang bei Erkrankung oder vorübergehender körperlicher Einschränkung')
    # Unrecognised or conditional wording is not turned into a permissive rule.
    return None


def build():
    park = json.loads((ROOT / 'dist/park-data.json').read_text())
    catalogue = {}
    for filename in ['official-attractions.json', 'official-entertainment.json']:
        catalogue.update({row['url']: row for row in json.loads((ROOT / 'sources' / filename).read_text())})
    snapshots = {row['catalogueUrl']: row for row in json.loads((ROOT / 'sources/official-page-facts.json').read_text())}
    photos = json.loads((ROOT / 'sources/official-photos.json').read_text())['entries']
    ages = json.loads((ROOT / 'sources/official-ages.json').read_text())
    recommendations = json.loads((ROOT / 'sources/age-recommendations.json').read_text())
    age_key = lambda url: '/'.join(urlparse(url or '').path.rstrip('/').split('/')[2:])
    age_title = lambda text: re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', text or '').lower())
    official_ages, named_ages = {}, {}
    for group, rows in ages['groups'].items():
        for age_row in rows:
            official_ages.setdefault(age_key(age_row['url']), []).append(group)
            named_ages.setdefault(age_title(age_row['name']), []).append(group)
    station_ids = {'ride-p1da10', 'ride-p1na16', 'ride-p1ra10'}
    railroad_url = 'https://www.disneylandparis.com/en-gb/attractions/disneyland-park/disneyland-railroad-main-street-station'
    entries = {}
    for ride in park['rides']:
        row = catalogue.get(ride.get('officialUrl'), {})
        snapshot = snapshots.get(ride.get('officialUrl'), {})
        # The page must have its own heading and remain on Disney's public domain.
        verified = disney_url(snapshot.get('url')) and same_title(snapshot.get('title', ''), row.get('name', ''))
        services, access = [], []
        omitted = 0
        if verified:
            for text in snapshot.get('services', []):
                fact = service_fact(text)
                if fact:
                    (services if fact[0] == 'service' else access).append(fact[1])
                else:
                    omitted += 1
            if snapshot.get('pregnancyRestricted'):
                access = [x for x in access if 'Schwangere' not in x]
                access.append('Laut Disney für Schwangere nicht geeignet')
            if snapshot.get('healthWarning'):
                access.append('Disney nennt gesundheitliche Einschränkungen; vollständige Zugangsvorgaben vor Ort prüfen')
        details = row.get('details', '')
        tags = []
        for term, label in [
            ('Single Rider Service', 'Single Rider vorhanden'),
            ('Disney PhotoPass', 'Disney PhotoPass'),
            ('Disney Premier Access One', 'Premier Access One'),
            ('Disney Premier Access Ultimate', 'Premier Access Ultimate'),
            ('Reserved Viewing Area', 'Reservierter Zuschauerbereich verfügbar'),
            ('Virtual Queue', 'Virtuelle Warteschlange'),
        ]:
            if term in details:
                services.append(label)
        for term, label in [
            ('Big Thrills', 'Intensive Attraktion'),
            ('May Frighten Younger Guests', 'Kann kleinere Kinder erschrecken'),
            ('Guest May Get Splashed', 'Spritzwasser möglich'),
            ('Relaxing Walks', 'Rundgang / Spaziergang'),
            ('Botanical walk', 'Botanischer Rundgang'),
            ('Fun For Little Ones', 'Auch für kleinere Kinder gedacht'),
            ('Family Adventure', 'Familienerlebnis'),
            ('Indoor', 'Indoor'), ('Outdoor', 'Im Freien'),
            ('Fireworks', 'Feuerwerk'), ('Nighttime Spectaculars', 'Abendshow'),
            ('Concerts', 'Konzert'), ('Parades', 'Parade'), ('Stage Shows', 'Bühnenshow'),
        ]:
            if term in details:
                tags.append(label)
        source = snapshot.get('germanUrl') if verified and disney_url(snapshot.get('germanUrl')) else ride.get('officialUrl')
        age_source = railroad_url if ride['id'] in station_ids else ride.get('officialUrl')
        # Disney sometimes switches catalogue URLs to -app/custom landing aliases.
        # Match the exact normalized official heading as well; never fuzzy-match ages.
        by_name = named_ages.get(age_title(row.get('name', '')), [])
        age_groups = list(dict.fromkeys(official_ages.get(age_key(age_source), []) + by_name))
        if not age_groups:
            age_groups = [age for age in ['All Ages', 'Preschoolers', 'Kids', 'Tweens', 'Teens', 'Adults'] if age in details]
        recommendation = recommendations.get(ride['id'])
        entries[ride['id']] = {
            'name': ride.get('officialName', ride['name']),
            'sourceUrl': source if disney_url(source) else None,
            'catalogueDate': park['catalogue']['updatedAt'],
            'detailDate': snapshot.get('checkedAt', '')[:10] if verified else None,
            'services': list(dict.fromkeys(services)),
            'access': list(dict.fromkeys(access)),
            'tags': list(dict.fromkeys(tags)),
            'ageGroups': age_groups,
            'ageSourceUrl': age_source if age_groups and disney_url(age_source) else None,
            'ageDate': ages['checkedAt'] if age_key(age_source) in official_ages else park['catalogue']['updatedAt'],
            'ageRecommendation': recommendation,
            'moreOnOriginal': bool(omitted),
            'photos': photos.get(ride.get('officialUrl'), {}).get('photos', []),
        }
    payload = json.dumps(entries, ensure_ascii=False, separators=(',', ':'))
    output = '''/* Generated by prepare-disney-guide.py. Public factual snapshots only. */
(function(root){'use strict';
const entries=PAYLOAD;
const guide=Object.freeze({count:Object.keys(entries).length,date:DATE,get:id=>Object.hasOwn(entries,id)?entries[id]:null});
if(typeof module==='object'&&module.exports)module.exports=guide;else root.DisneyGuide=guide;
})(typeof globalThis!=='undefined'?globalThis:this);
'''.replace('PAYLOAD', payload).replace('DATE', json.dumps(park['catalogue']['updatedAt']))
    (ROOT / 'dist/disney-guide.js').write_text(output)
    print(f"{len(entries)} cached entries; {sum(bool(e['detailDate']) for e in entries.values())} public detail pages verified; {len(output.encode())} bytes")


if __name__ == '__main__':
    build()
