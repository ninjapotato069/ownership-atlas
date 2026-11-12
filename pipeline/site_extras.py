#!/usr/bin/env python3
"""Extra files for the published site: version.json (newest app, from GitHub releases or app/latest.json), companies.csv
(today's market list for spreadsheets), .nojekyll and a robots.txt. Usage: site_extras.py <site dir>"""
import csv
import json
import os
import sys
import urllib.request

out = sys.argv[1]
repo = os.environ.get('GITHUB_REPOSITORY', 'ninjapotato069/ownership-atlas')
token = os.environ.get('TOKEN', '')

# Newest app release: tags look like app-v1.7, with the APK attached.
version = {}
try:
    req = urllib.request.Request('https://api.github.com/repos/%s/releases?per_page=20' % repo,
                                 headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'ownership-atlas',
                                          **({'Authorization': 'Bearer ' + token} if token else {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        rels = json.loads(r.read())
    for rel in rels:
        if rel.get('draft') or rel.get('prerelease') or not rel.get('tag_name', '').startswith('app-v'):
            continue
        apk = next((a['browser_download_url'] for a in rel.get('assets', []) if a['name'].endswith('.apk')), None)
        body = rel.get('body') or ''
        code = next((int(w.split('=')[1]) for w in body.split() if w.startswith('versionCode=') and w.split('=')[1].isdigit()), 0)
        if apk and code:
            version = {'versionCode': code, 'versionName': rel['tag_name'][5:], 'apk': apk, 'published': rel.get('published_at')}
            break
except Exception as e:
    print('version.json: could not read releases:', e)
# An APK published with the site (app/releases/ in the repository, copied to app/ here) counts too.
try:
    with open(os.path.join(out, 'app', 'latest.json'), encoding='utf-8') as f:
        lat = json.load(f)
    if lat.get('versionCode', 0) > version.get('versionCode', 0) and os.path.isfile(os.path.join(out, 'app', lat['file'])):
        site = 'https://%s.github.io/%s/' % tuple(repo.split('/'))
        version = {'versionCode': lat['versionCode'], 'versionName': lat['versionName'], 'apk': site + 'app/' + lat['file'],
                   'published': lat.get('published')}
except (OSError, ValueError, KeyError) as e:
    print('version.json: no APK with the site:', e)
with open(os.path.join(out, 'version.json'), 'w') as f:
    json.dump(version, f)
print('version.json:', version or 'no release yet')

# Today's market list as a spreadsheet.
try:
    with open(os.path.join(out, 'live', 'markets.json'), encoding='utf-8') as f:
        mk = json.load(f)
    ci = {c: i for i, c in enumerate(mk['cols'])}
    with open(os.path.join(out, 'companies.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['rank', 'company', 'symbol', 'country', 'sector', 'industry', 'market_value_usd_bn', 'price_usd',
                    'change_1d_pct', 'change_1m_pct', 'change_ytd_pct', 'revenue_ttm_usd_bn', 'net_income_ttm_usd_bn',
                    'employees', 'atlas_id'])
        rows = sorted(mk['rows'], key=lambda r: -r[ci['m']])
        lab = lambda arr, i: arr[i] if isinstance(i, int) and 0 <= i < len(arr) else ''
        bn = lambda v: '' if v is None else '%.2f' % (v / 1000)
        for n, r in enumerate(rows, 1):
            w.writerow([n, r[ci['n']], r[ci['s']], r[ci['cc']], lab(mk['sectors'], r[ci['sec']]), lab(mk['industries'], r[ci['ind']]),
                        bn(r[ci['m']]), r[ci['px']] if r[ci['px']] is not None else '', r[ci['d1']] if r[ci['d1']] is not None else '',
                        r[ci['m1']] if r[ci['m1']] is not None else '', r[ci['ytd']] if r[ci['ytd']] is not None else '',
                        bn(r[ci['rev']]), bn(r[ci['ni']]), r[ci['emp']] if r[ci['emp']] is not None else '', r[ci['a']] or ''])
    print('companies.csv:', len(rows), 'rows')
except (OSError, KeyError, ValueError) as e:
    print('companies.csv skipped:', e)

open(os.path.join(out, '.nojekyll'), 'w').close()
with open(os.path.join(out, 'robots.txt'), 'w') as f:
    f.write('User-agent: *\nAllow: /\n')
