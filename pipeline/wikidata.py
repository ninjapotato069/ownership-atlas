#!/usr/bin/env python3
"""Wikidata details for the companies in the market list: founding year, description, country, website,
and who owns them (parent organisations, and holders with a stated stake of 10% or more).

Companies are matched to Wikidata by ISIN when the screener gives one, then by stock exchange (ISO 10383
market identifier code) and ticker, then, for a limited number of the largest leftovers, by name search
checked against country. Owners are followed two levels up (a subsidiary's parent and that parent's own
owners). Standard library only.

Reads live/universe.json, live/markets.json and config/atlas_map.json; writes live/wikidata.json.
Mode "auto" (default): a full refresh when the cache is missing or more than 7 days old, otherwise only
companies not looked up yet. Wikidata is maintained by volunteers: figures can be out of date, so the
atlas marks everything taken from it.
"""
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIVE = os.path.join(ROOT, 'live')
OUT = os.path.join(LIVE, 'wikidata.json')
UA = 'OwnershipAtlas/1.0 (https://github.com/ninjapotato069/ownership-atlas; data pipeline)'
SPARQL = 'https://query.wikidata.org/sparql'
API = 'https://www.wikidata.org/w/api.php'
MIN_STAKE = 0.10          # holders below this share are left out
NAME_SEARCH_CAP = 400     # name searches per run (largest unmatched companies first)
FULL_EVERY_DAYS = 7
LOG = []
TODAY = dt.datetime.now(dt.timezone.utc).date()

# Screener exchange prefix -> ISO 10383 market identifier codes, as Wikidata records them on exchanges (P2283).
MICS = {
    'NASDAQ': ['XNAS'], 'NYSE': ['XNYS'], 'AMEX': ['XASE'], 'CBOE': ['BATS', 'XCBO'], 'TSX': ['XTSE'],
    'TSXV': ['XTSX'], 'NEO': ['NEOE'], 'BMV': ['XMEX'], 'BIVA': ['BIVA'], 'BMFBOVESPA': ['BVMF'], 'BCBA': ['XBUE'],
    'BCS': ['XSGO'], 'BVC': ['XBOG'], 'BVL': ['XLIM'], 'LSE': ['XLON'], 'XETR': ['XETR', 'XFRA'], 'FWB': ['XFRA'],
    'EURONEXT': ['XPAR', 'XAMS', 'XBRU', 'XLIS', 'XDUB', 'XMSM'], 'OSL': ['XOSL'], 'MIL': ['XMIL', 'MTAA'],
    'BME': ['XMAD', 'BMEX'], 'SIX': ['XSWX', 'XVTX'], 'VIE': ['XWBO'], 'OMXSTO': ['XSTO'], 'OMXCOP': ['XCSE'],
    'OMXHEX': ['XHEL'], 'OMXICE': ['XICE'], 'GPW': ['XWAR'], 'PSECZ': ['XPRA'], 'BET': ['XBUD'], 'BVB': ['XBSE'],
    'ATHEX': ['ASEX'], 'BIST': ['XIST'], 'TASE': ['XTAE'], 'LUXSE': ['XLUX'], 'JSE': ['XJSE'], 'NSENG': ['XNSA'],
    'NSEKE': ['XNAI'], 'CSEMA': ['XCAS'], 'EGX': ['XCAI'], 'TADAWUL': ['XSAU'], 'ADX': ['XADS'], 'DFM': ['XDFM'],
    'QSE': ['DSMD'], 'KSE': ['XKUW'], 'TSE': ['XTKS', 'XJPX'], 'HKEX': ['XHKG'], 'SSE': ['XSHG'], 'SZSE': ['XSHE'],
    'BSE': ['XBOM'], 'NSE': ['XNSE'], 'KRX': ['XKRX', 'XKOS'], 'TWSE': ['XTAI'], 'TPEX': ['ROCO'], 'SGX': ['XSES'],
    'SET': ['XBKK'], 'IDX': ['XIDX'], 'MYX': ['XKLS'], 'PSE': ['XPHS'], 'HOSE': ['XSTC'], 'HNX': ['HSTC'],
    'ASX': ['XASX'], 'NZX': ['XNZE'], 'RUS': ['MISX', 'XMOS'],
}


def log(*parts):
    line = ' '.join(str(p) for p in parts)
    print(line, flush=True)
    LOG.append(line)


def request(url, data=None, accept='application/json', tries=5):
    head = {'User-Agent': UA, 'Accept': accept}
    if data is not None:
        head['Content-Type'] = 'application/x-www-form-urlencoded'
    err = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=head)
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            err = 'HTTP %s' % e.code
            wait = e.headers.get('Retry-After') if e.headers else None
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(min(90, int(wait) if wait and wait.isdigit() else 8 * (attempt + 1)))
                continue
            break
        except Exception as e:
            err = repr(e)
            time.sleep(6 * (attempt + 1))
    raise RuntimeError('%s: %s' % (url.split('?')[0], err))


def sparql(query):
    """Rows of string values; a short pause after each call keeps within the service's limits."""
    j = request(SPARQL, data=urllib.parse.urlencode({'query': query}).encode(), accept='application/sparql-results+json')
    time.sleep(1.2)
    out = []
    for b in j.get('results', {}).get('bindings', []):
        out.append({k: v.get('value') for k, v in b.items()})
    return out


def qid(uri):
    return uri.rsplit('/', 1)[-1] if uri else None


def year(v):
    m = re.match(r'^(-?\d{1,4})-', v or '')
    return int(m.group(1)) if m else None


def chunks(xs, n):
    xs = list(xs)
    for i in range(0, len(xs), n):
        yield xs[i:i + n]


def tnorm(t):
    t = re.sub(r'[^A-Z0-9]', '', (t or '').upper())
    return t.lstrip('0') or t


def load(name, default):
    try:
        with open(os.path.join(LIVE, name), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


# ---------------------------------------------------------------- matching companies

def match_isin(want):
    """want: {sym: isin} -> {sym: qid}"""
    found = {}
    by_isin = {}
    for s, i in want.items():
        by_isin.setdefault(i, []).append(s)
    for part in chunks(by_isin, 250):
        vals = ' '.join('"%s"' % i for i in part if re.match(r'^[A-Z0-9]{12}$', i))
        if not vals:
            continue
        for r in sparql('SELECT ?item ?isin WHERE { VALUES ?isin { %s } ?item wdt:P946 ?isin . }' % vals):
            for s in by_isin.get(r['isin'], []):
                found.setdefault(s, qid(r['item']))
    return found


def match_tickers(syms):
    """Exchange + ticker. syms: list of 'EXCH:TICKER' -> {sym: qid}"""
    by_ex = {}
    for s in syms:
        ex, _, t = s.partition(':')
        if ex in MICS:
            by_ex.setdefault(ex, {})[tnorm(t)] = s
    found = {}
    for ex, wanted in sorted(by_ex.items()):
        vals = ' '.join('"%s"' % m for m in MICS[ex])
        q = ('SELECT ?item ?ticker WHERE { VALUES ?mic { %s } ?x wdt:P2283 ?mic . '
             '?item p:P414 ?st . ?st ps:P414 ?x ; pq:P249 ?ticker . FILTER NOT EXISTS { ?st pq:P582 [] } }' % vals)
        try:
            rows = sparql(q)
        except Exception as e:
            log('  tickers %s failed: %s' % (ex, e))
            continue
        hits, seen = 0, {}
        for r in rows:
            k = tnorm(r['ticker'])
            if k in wanted:
                seen.setdefault(k, set()).add(qid(r['item']))
        for k, items in seen.items():
            if len(items) == 1:          # one company per ticker, or it is ambiguous
                found[wanted[k]] = next(iter(items))
                hits += 1
        log('  %-10s %4d of %4d matched by ticker (%d listings on Wikidata)' % (ex, hits, len(wanted), len(rows)))
    return found


def match_names(cands, cap):
    """cands: [(sym, name, cc)] largest first -> {sym: qid}. Search by name, keep the first result
    in the same country that looks like a business."""
    found = {}
    for sym, name, cc in cands[:cap]:
        try:
            j = request(API + '?' + urllib.parse.urlencode({'action': 'wbsearchentities', 'search': name, 'language': 'en',
                                                            'type': 'item', 'limit': 5, 'format': 'json'}))
        except Exception:
            continue
        time.sleep(0.15)
        ids = [h['id'] for h in j.get('search', []) if h.get('id', '').startswith('Q')]
        if not ids:
            continue
        q = ('SELECT ?item ?cc ?biz WHERE { VALUES ?item { %s } ?item wdt:P17 ?c . ?c wdt:P297 ?cc . '
             'OPTIONAL { ?item wdt:P414|wdt:P452|wdt:P1128|wdt:P2139|wdt:P946 ?b . BIND(1 AS ?biz) } }'
             % ' '.join('wd:' + i for i in ids))
        try:
            rows = sparql(q)
        except Exception:
            continue
        ok = {qid(r['item']) for r in rows if r.get('cc') == cc and r.get('biz')}
        pick = next((i for i in ids if i in ok), None)
        if pick:
            found[sym] = pick
    return found


# ---------------------------------------------------------------- details and owners

def details(qids):
    """{qid: {l, d, f, cc, w}} for companies."""
    out = {}
    for part in chunks(sorted(qids), 200):
        q = ('SELECT ?item ?label ?desc ?inc ?cc ?web WHERE { VALUES ?item { %s } '
             'OPTIONAL { ?item rdfs:label ?label FILTER(LANG(?label) = "en") } '
             'OPTIONAL { ?item schema:description ?desc FILTER(LANG(?desc) = "en") } '
             'OPTIONAL { ?item wdt:P571 ?inc } OPTIONAL { ?item wdt:P17 ?c . ?c wdt:P297 ?cc } '
             'OPTIONAL { ?item wdt:P856 ?web } }' % ' '.join('wd:' + i for i in part))
        for r in sparql(q):
            i = qid(r['item'])
            o = out.setdefault(i, {})
            if r.get('label'):
                o['l'] = r['label']
            if r.get('desc'):
                o['d'] = r['desc']
            y = year(r.get('inc'))
            if y and 1500 <= y <= TODAY.year and (o.get('f') is None or y < o['f']):
                o['f'] = y
            if r.get('cc'):
                o.setdefault('cc', r['cc'])
            if r.get('web') and 'w' not in o and len(r['web']) < 200:
                o['w'] = r['web']
    return out


def owners(qids):
    """[{s: owner, t: owned, k: parent|owner, p: share 0-100 or None, y: start year}]"""
    rels = []
    for part in chunks(sorted(qids), 150):
        q = ('SELECT ?item ?owner ?kind ?prop ?unit ?start WHERE { VALUES ?item { %s } '
             '{ ?item p:P749 ?st . ?st ps:P749 ?owner . BIND("parent" AS ?kind) } UNION '
             '{ ?item p:P127 ?st . ?st ps:P127 ?owner . BIND("owner" AS ?kind) } '
             '?st wikibase:rank ?rank . FILTER(?rank != wikibase:DeprecatedRank) '
             'FILTER NOT EXISTS { ?st pq:P582 [] } FILTER(isIRI(?owner)) '
             'OPTIONAL { ?st pqv:P1107 ?pv . ?pv wikibase:quantityAmount ?prop . OPTIONAL { ?pv wikibase:quantityUnit ?unit } } '
             'OPTIONAL { ?st pq:P580 ?start } }' % ' '.join('wd:' + i for i in part))
        for r in sparql(q):
            p = None
            if r.get('prop'):
                try:
                    v = float(r['prop'])
                    pct = 'Q11229' in (r.get('unit') or '') or v > 1.0
                    p = v if pct else v * 100
                except ValueError:
                    p = None
                if p is not None and not (0 < p <= 100):
                    p = None
            rels.append({'s': qid(r['owner']), 't': qid(r['item']), 'k': r['kind'], 'p': p, 'y': year(r.get('start'))})
    return rels


GOV_WORDS = re.compile(r'\b(government|ministry|ministries|state of|republic of|kingdom of|commonwealth of|federal|'
                       r'municipal|city of|province|provincial|state-owned assets|sasac|sovereign wealth|public investment fund|'
                       r'state agency|government agency|treasury|central bank|national bank of|state holding|state fund)\b', re.I)
FUND_WORDS = re.compile(r'\b(investment (?:fund|company|firm|manager|management|trust)|asset manag\w*|private equity|'
                        r'venture capital|hedge fund|pension|mutual fund|investment holding|holding company|'
                        r'family office|wealth fund|endowment)\b', re.I)
FOUNDATION_WORDS = re.compile(r'\b(foundation|charit\w*|non-?profit|trust fund|stiftung|fondation|fundaci\w*|cooperative|co-operative)\b', re.I)


def org_details(qids):
    """{qid: {l, d, f, cc, k}} for owners: k is human, country, gov, fund, foundation or company."""
    out = {}
    for part in chunks(sorted(qids), 150):
        q = ('SELECT ?o ?label ?desc ?human ?iso ?cc ?cc2 ?inc ?birth WHERE { VALUES ?o { %s } '
             'OPTIONAL { ?o rdfs:label ?label FILTER(LANG(?label) = "en") } '
             'OPTIONAL { ?o schema:description ?desc FILTER(LANG(?desc) = "en") } '
             'OPTIONAL { ?o wdt:P31 wd:Q5 . BIND(1 AS ?human) } OPTIONAL { ?o wdt:P297 ?iso } '
             'OPTIONAL { ?o wdt:P17 ?c . ?c wdt:P297 ?cc } OPTIONAL { ?o wdt:P27 ?c2 . ?c2 wdt:P297 ?cc2 } '
             'OPTIONAL { ?o wdt:P571 ?inc } OPTIONAL { ?o wdt:P569 ?birth } }' % ' '.join('wd:' + i for i in part))
        for r in sparql(q):
            i = qid(r['o'])
            o = out.setdefault(i, {})
            for a, b in (('label', 'l'), ('desc', 'd')):
                if r.get(a):
                    o[b] = r[a]
            if r.get('human'):
                o['k'] = 'human'
            if r.get('iso'):
                o['iso'] = r['iso']
            cc = r.get('cc') or r.get('cc2')
            if cc:
                o.setdefault('cc', cc)
            y = year(r.get('inc')) or year(r.get('birth'))
            if y and 1000 <= y <= TODAY.year and (o.get('f') is None or y < o['f']):
                o['f'] = y
    for o in out.values():
        if o.get('k') == 'human':
            continue
        text = '%s %s' % (o.get('l', ''), o.get('d', ''))
        if o.get('iso'):
            o['k'] = 'country'
            o['cc'] = o['iso']
        elif GOV_WORDS.search(text):
            o['k'] = 'gov'
        elif FOUNDATION_WORDS.search(text):
            o['k'] = 'foundation'
        elif FUND_WORDS.search(text):
            o['k'] = 'fund'
        else:
            o['k'] = 'company'
    return out


# ---------------------------------------------------------------- run

def main(mode):
    uni = load('universe.json', {}).get('members', {})
    mk = load('markets.json', {})
    try:
        with open(os.path.join(ROOT, 'config', 'atlas_map.json'), encoding='utf-8') as f:
            amap = json.load(f).get('symbols', {})
    except (OSError, ValueError):
        amap = {}
    if not uni and not amap:
        log('No universe yet; nothing to do.')
        return 0
    value = {}
    if mk.get('rows'):
        ci = {c: i for i, c in enumerate(mk['cols'])}
        for r in mk['rows']:
            value[r[ci['s']]] = r[ci['m']]
    cache = load('wikidata.json', {})
    full = mode == 'full' or not cache.get('companies') or \
        (TODAY - dt.date.fromisoformat(cache.get('full', '2000-01-01'))).days >= FULL_EVERY_DAYS
    companies = {} if full else cache.get('companies', {})
    tried = {} if full else cache.get('tried', {})
    syms = sorted(set(uni) | set(amap))
    todo = [s for s in syms if s not in companies and (full or tried.get(s) != TODAY.isoformat())]
    log('wikidata: %s run, %d companies to look up (%d known)' % ('full' if full else 'incremental', len(todo), len(companies)))

    found = {}
    isins = {s: uni[s]['isin'] for s in todo if s in uni and uni[s].get('isin')}
    if isins:
        found.update(match_isin(isins))
        log('  %d of %d matched by ISIN' % (len(found), len(isins)))
    rest = [s for s in todo if s not in found]
    if rest:
        found.update(match_tickers(rest))
    rest = [s for s in todo if s not in found]
    cands = sorted(((s, uni[s]['n'] if s in uni else s.split(':')[1], uni[s]['cc'] if s in uni else '') for s in rest),
                   key=lambda c: -value.get(c[0], 0))
    cands = [c for c in cands if c[2]]
    by_name = match_names(cands, NAME_SEARCH_CAP)
    found.update(by_name)
    log('  %d matched by name search (of %d tried)' % (len(by_name), min(len(cands), NAME_SEARCH_CAP)))
    for s in todo:
        tried[s] = TODAY.isoformat()

    det = details(set(found.values()))
    for s, q in found.items():
        companies[s] = dict(det.get(q, {}), q=q)
    log('  companies with Wikidata details: %d' % len(companies))

    # Owners: two levels up. Re-read for every known company on a full run, only new ones otherwise.
    prev_rels = [] if full else cache.get('rels', [])
    level1 = {c['q'] for c in companies.values()} if full else set(found.values())
    rels = owners(level1)
    known = {c['q'] for c in companies.values()}
    up = {r['s'] for r in rels} - known
    orgs = {} if full else cache.get('orgs', {})
    od = org_details(up - set(orgs))
    orgs.update(od)
    level2 = {q for q in up if orgs.get(q, {}).get('k') in ('company', 'fund')}
    rels2 = owners(level2) if level2 else []
    up2 = {r['s'] for r in rels2} - known - set(orgs)
    orgs.update(org_details(up2))
    seen, all_rels = set(), []
    for r in prev_rels + rels + rels2:
        if r['k'] == 'owner' and (r['p'] is None or r['p'] < MIN_STAKE * 100) and \
                orgs.get(r['s'], {}).get('k') not in ('country', 'gov'):
            continue          # small or undisclosed holdings, except by a state
        key = (r['s'], r['t'], r['k'])
        if key in seen or r['s'] == r['t']:
            continue
        seen.add(key)
        all_rels.append(r)
    for q in list(orgs):
        if q in known:
            orgs.pop(q)
    doc = {'v': 1, 'updated': TODAY.isoformat(), 'full': TODAY.isoformat() if full else cache.get('full'),
           'companies': companies, 'orgs': orgs, 'rels': all_rels, 'tried': tried,
           'note': 'From Wikidata (CC0). Owners: parent organisations (P749) and holders (P127) with a stated share of '
                   '%d%% or more, or a state; statements with an end date are left out.' % int(MIN_STAKE * 100)}
    os.makedirs(LIVE, exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
    kinds = {}
    for o in orgs.values():
        kinds[o.get('k')] = kinds.get(o.get('k'), 0) + 1
    log('wikidata: %d companies matched, %d owner organisations %s, %d ownership links, %d KB' %
        (len(companies), len(orgs), json.dumps(kinds, sort_keys=True), len(all_rels), os.path.getsize(OUT) // 1024))
    return 0


def annotate(code):
    if not os.environ.get('GITHUB_ACTIONS'):
        return
    text = '\n'.join(LOG[-60:]).replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
    print('::%s title=Wikidata::%s' % ('notice' if code == 0 else 'warning', text), flush=True)


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'auto'
    try:
        rc = main(mode)
    except Exception as e:  # Wikidata trouble must not stop the daily refresh: keep the old cache
        log('Wikidata step failed: %r. Keeping the previous file.' % (e,))
        rc = 0
    annotate(rc)
    sys.exit(rc)
