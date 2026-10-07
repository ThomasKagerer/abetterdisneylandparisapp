#!/usr/bin/env python3
"""Download compact photos observed in Disney's public catalogue/detail pages."""
import hashlib
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent


def photo_url(value):
    u = urlsplit(value)
    if u.scheme != 'https' or u.hostname != 'media.disneylandparis.com':
        raise ValueError('Unexpected photo source')
    return urlunsplit((u.scheme, u.netloc, u.path, 'w=800&f=webp', ''))


def download(url):
    stem = hashlib.sha256(url.encode()).hexdigest()[:16]
    for extension in ('webp', 'gif'):
        path = ROOT / 'dist/photos' / (stem + '.' + extension)
        if path.exists():
            return url, str(path.relative_to(ROOT / 'dist'))
    with urlopen(url, timeout=30) as response:
        content = response.read(1_000_001)
        if not response.headers.get('Content-Type', '').startswith('image/'):
            raise ValueError(f'Photo source did not return an image: {url}')
    if len(content) > 1_000_000:
        raise ValueError(f'Photo exceeds compact image limit: {url}')
    if content[:4] == b'RIFF' and content[8:12] == b'WEBP':
        extension = 'webp'
    elif content[:6] in (b'GIF87a', b'GIF89a'):
        # Disney serves its animated gallery diagrams as GIF even with f=webp.
        # Preserve the original animation rather than losing a gallery item.
        extension = 'gif'
    else:
        raise ValueError(f'Unexpected photo format: {url}')
    path = ROOT / 'dist/photos' / (stem + '.' + extension)
    path.write_bytes(content)
    return url, str(path.relative_to(ROOT / 'dist'))


def build():
    capture = json.loads((ROOT / 'sources/official-photo-catalogue.json').read_text())
    galleries = json.loads((ROOT / 'sources/official-galleries.json').read_text())
    rows = {}
    for source, card in capture['catalogue'].items():
        detail = capture['details'].get(source, {})
        if 'spiderman-web-adventure' in source:
            detail = capture['details'].get(source.replace('spiderman', 'spider-man'), {})
        gallery = galleries['entries'].get(source)
        if gallery and gallery['images']:
            candidates = gallery['images']
            if gallery['mode'] != 'gallery':
                # Modern pages mix attraction photos with service icons and
                # generic adverts. Only filter these non-gallery page images.
                unrelated = re.compile(r'card-icon|icon_|separator|f428__|e149_|e275__|app-promotion|promo-app|reserved-viewing-area-key-visual|park-tickets|service-visiteur|disabled-visitor|accessibility|map-disneyland|photopass|my-royal-dream|secure-your-seat|world-of-frozen-family|families-with-young-kids-donald', re.I)
                candidates = [i for i in candidates if not unrelated.search(i['url'])]
        else:
            candidates = card['images'] + detail.get('images', [])
        urls = list(dict.fromkeys(photo_url(i['url']) for i in candidates))
        rows[source] = {'title': card['title'], 'urls': urls}
    (ROOT / 'dist/photos').mkdir(exist_ok=True)
    unique = list(dict.fromkeys(url for row in rows.values() for url in row['urls']))
    with ThreadPoolExecutor(max_workers=4) as pool:
        files = dict(pool.map(download, unique))
    entries = {source: {'title': row['title'], 'photos': [
        {'src': files[url], 'sourceUrl': url, 'credit': '© Disney'} for url in row['urls']
    ]} for source, row in rows.items()}
    (ROOT / 'sources/official-photos.json').write_text(json.dumps({
        'checkedAt': galleries['checkedAt'], 'entries': entries,
    }, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(entries)} catalogue entries; {len(files)} small local photos; '
          f'{sum((ROOT / "dist" / path).stat().st_size for path in files.values()) // 1024} KiB')


if __name__ == '__main__':
    build()
