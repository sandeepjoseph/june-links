"""Build an attributed, first-party venue photo index from the retained Wikidata IDs."""
import json, re, subprocess, urllib.parse, html, time, sys, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.media-research'
CACHE.mkdir(exist_ok=True)

def get(url, label):
    path = CACHE / (label + '.json')
    if not path.exists():
        subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '45',
                        '-A', 'JuneLinksConcept/1.0 (public venue media research)', url,
                        '-o', str(path)], check=True)
        time.sleep(3)
    data = json.loads(path.read_text())
    if 'error' in data:
        raise RuntimeError(str(data['error']))
    return data

def plain(value):
    return html.unescape(re.sub('<[^>]+>', '', value)).strip()[:240]

venues = json.loads((ROOT / 'public/assets/courses.json').read_text())['venues']
ids = [v['id'] for v in venues if re.fullmatch('Q[0-9]+', v['id'])]
facts, files = {}, {}
for start in range(0, len(ids), 50):
    if '--cached-claims-only' in sys.argv and not (CACHE / ('claims-' + str(start) + '.json')).exists():
        continue
    query = urllib.parse.urlencode({'action':'wbgetentities', 'ids':'|'.join(ids[start:start+50]),
                                  'props':'claims', 'format':'json', 'maxlag':5})
    data = get('https://www.wikidata.org/w/api.php?' + query, 'claims-' + str(start))
    for key, entity in data.get('entities', {}).items():
        claims = entity.get('claims', {})
        photo = next((c['mainsnak']['datavalue']['value'] for c in claims.get('P18', [])
                      if c.get('rank') != 'deprecated' and c.get('mainsnak', {}).get('datavalue')
                      and re.search(r'\.(jpe?g|png)$', c['mainsnak']['datavalue']['value'], re.I)), None)
        coord = next((c['mainsnak']['datavalue']['value'] for c in claims.get('P625', [])
                      if c.get('rank') != 'deprecated' and c.get('mainsnak', {}).get('datavalue')), None)
        facts[key] = {'file':photo}
        if coord and coord.get('globe') == 'http://www.wikidata.org/entity/Q2':
            facts[key]['coordinates'] = [coord['latitude'], coord['longitude']]
        if photo:
            files[photo] = None
    print('claims', min(start+50, len(ids)), '/', len(ids), flush=True)

def normalized_file(name):
    return str(name or '').replace('_',' ').strip()
queried = set()
def absorb(data):
    for page in data.get('query', {}).get('pages', {}).values():
        title = normalized_file(page['title'][5:])
        queried.add(title)
        info = page.get('imageinfo', [{}])[0]
        meta = info.get('extmetadata', {})
        license = plain(meta.get('LicenseShortName', {}).get('value', ''))
        url = info.get('thumburl', info.get('url', '')).split('?')[0]
        allowed = license.startswith(('CC BY ', 'CC BY-SA ', 'CC0', 'Public domain', 'PDM')) and not re.search(r'\b(logo|map|layout|crest|emblem|plan|diagram|flag)\b', title, re.I)
        if allowed and info.get('width', 0) >= 300 and info.get('height', 0) >= 180 and urllib.parse.urlparse(url).hostname in ('upload.wikimedia.org','thumb.wikimedia.org'):
            files[title] = {'remote':url, 'source':info['descriptionurl'],
                'author':plain(meta.get('Artist', {}).get('value', 'Wikimedia Commons contributor')),
                'license':license, 'licenseUrl':(meta.get('LicenseUrl', {}).get('value') or 'https://creativecommons.org/publicdomain/mark/1.0/').replace('http:', 'https:'),
                'alt':plain(meta.get('ObjectName', {}).get('value', page['title'][5:]))}
for cached in sorted(CACHE.glob('media-*.json')):
    absorb(json.loads(cached.read_text()))
titles = [f for f in list(files) if normalized_file(f) not in queried]
for start in range(0, len(titles), 30):
    query = urllib.parse.urlencode({'action':'query', 'titles':'|'.join('File:'+f for f in titles[start:start+30]),
                                   'prop':'imageinfo', 'iiprop':'url|size|extmetadata',
                                   'iiurlwidth':800, 'format':'json', 'maxlag':5})
    data = get('https://commons.wikimedia.org/w/api.php?' + query, 'media-' + hashlib.sha256(query.encode()).hexdigest()[:12])
    absorb(data)
    print('new media', min(start+30, len(titles)), '/', len(titles), flush=True)

index = {}
for v in venues:
    f = facts.get(v['id'], {})
    item = {}
    if f.get('coordinates'):
        item['coordinates'] = f['coordinates']
    if files.get(normalized_file(f.get('file'))):
        item.update(files[normalized_file(f['file'])])
    if item:
        index[v['id']] = item
featured = {'adare':('adare', [52.5638, -8.7745]), 'andermatt':('andermatt',[46.6406,8.5842]),
            'bernardus':('bernardus',[51.653,5.218]), 'brohof':('brohof',[59.479,17.715])}
for key, (asset, coord) in featured.items():
    index[key] = {'local':'/assets/'+asset+'-800.webp','coordinates':coord,
                  'source':next(v['source'] for v in venues if v['id']==key),
                  'author':'Official venue media · concept preview', 'license':'Permission required for public release',
                  'alt':next(v['name'] for v in venues if v['id']==key)}
# Prefer the already verified, licensed panorama rather than a duplicate download.
if 'Q167245' in index:
    index['Q167245'].update(local='/assets/standrews-800.webp',
       source='https://commons.wikimedia.org/wiki/File:R%26A_Clubhouse,_Old_Course,_Swilcan_Burn_bridge.jpg',
       author='Optograph', license='CC BY-SA 3.0', licenseUrl='https://creativecommons.org/licenses/by-sa/3.0/')
for alias, identifier in {'standrews':'Q167245','pebble':'Q534974','cape':'Q5034887'}.items():
    if index.get(identifier, {}).get('coordinates'):
        index[alias] = {'coordinates':index[identifier]['coordinates']}
index['quinta'] = {'coordinates':[37.0582318,-8.0271329], 'coordinateSource':'https://www.ega-golf.ch/content/quinta-do-lago-south-course'}
result = {'retrieved':'2026-11-03', 'source':'Wikidata P18/P625, Wikimedia Commons file metadata; original official featured media retained.',
          'venueCount':len(venues), 'recordsResearched':len(facts), 'photoCount':sum(bool(i.get('remote') or i.get('local')) for i in index.values()), 'venues':index}
(ROOT / 'public/assets/venue-media.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',',':')))
print('RESULT', len(venues), result['photoCount'], 'venue photographs;', len(index), 'venue records', flush=True)
