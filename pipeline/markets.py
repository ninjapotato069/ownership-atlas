#!/usr/bin/env python3
"""Daily market list for the Ownership Atlas: every listed company worth about US$3 billion or more.

Source: TradingView's public stock screener (delayed prices, values converted to US dollars), read
market by market. Standard library only.

State lives in live/ (the workflow restores it from the published site before running):
  universe.json   the listed companies the atlas has added as entities of their own, with stable ids.
                  A company joins at $3B or more and leaves after 30 days below $1.5B, or 14 days unseen.
  markets.json    today's figures for every company in the atlas that the screener lists at $1.5B or
                  more: the hand-built atlas companies (config/atlas_map.json) and the universe.
  status.json     what this run did.
If the screener cannot be read, yesterday's files stay and the run still succeeds, so the site and
the app keep working.
"""
import csv
import datetime as dt
import gzip
import io
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request

READ_MIN = 1.5e9          # read and keep figures down to this market value
ADD_MIN = 3e9             # a company joins the atlas at this value
DROP_DAYS_LOW = 30        # ... and leaves after this many days below READ_MIN
DROP_DAYS_GONE = 14       # ... or this many days missing from the screener
MIN_COUNT = 2500          # far fewer rows than this means a partial answer, not a market crash
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIVE = os.path.join(ROOT, 'live')
MAP_FILE = os.path.join(ROOT, 'config', 'atlas_map.json')
DATA_DIR = os.path.join(ROOT, 'data')
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36')
LOG = []
TODAY = dt.datetime.now(dt.timezone.utc).date()


def log(*parts):
    line = ' '.join(str(p) for p in parts)
    print(line, flush=True)
    LOG.append(line)


def http(url, body=None, headers=None, timeout=90, tries=3):
    data = None if body is None else json.dumps(body).encode()
    head = {'User-Agent': UA, 'Accept': 'application/json, text/csv, text/plain, */*',
            'Accept-Encoding': 'gzip', 'Accept-Language': 'en-US,en;q=0.9'}
    if data is not None:
        head['Content-Type'] = 'application/json'
    head.update(headers or {})
    err = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=head,
                                         method='POST' if data is not None else 'GET')
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
            if raw[:2] == b'\x1f\x8b':
                raw = gzip.decompress(raw)
            return raw.decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            try:
                detail = e.read()
                if detail[:2] == b'\x1f\x8b':
                    detail = gzip.decompress(detail)
                detail = detail[:300].decode('utf-8', 'replace')
            except Exception:
                detail = ''
            err = 'HTTP %s %s' % (e.code, detail)
            if e.code in (400, 401, 403, 404, 422):
                break
        except Exception as e:  # network trouble: try again
            err = repr(e)
        time.sleep(4 * (attempt + 1))
    raise RuntimeError('%s: %s' % (url.split('?')[0], err))


# ---------------------------------------------------------------- countries

COUNTRY = {
    'United States': 'US', 'United States of America': 'US', 'USA': 'US', 'China': 'CN', 'Japan': 'JP',
    'India': 'IN', 'United Kingdom': 'GB', 'UK': 'GB', 'Canada': 'CA', 'France': 'FR', 'Germany': 'DE',
    'Switzerland': 'CH', 'Netherlands': 'NL', 'Saudi Arabia': 'SA', 'Taiwan': 'TW',
    'South Korea': 'KR', 'Korea': 'KR', 'Korea, Republic of': 'KR', 'Republic of Korea': 'KR',
    'Hong Kong': 'HK', 'Australia': 'AU', 'Brazil': 'BR', 'Spain': 'ES', 'Italy': 'IT', 'Sweden': 'SE',
    'Denmark': 'DK', 'Ireland': 'IE', 'Singapore': 'SG', 'United Arab Emirates': 'AE', 'UAE': 'AE',
    'Mexico': 'MX', 'Indonesia': 'ID', 'Belgium': 'BE', 'Finland': 'FI', 'Norway': 'NO',
    'South Africa': 'ZA', 'Thailand': 'TH', 'Malaysia': 'MY', 'Israel': 'IL', 'Bermuda': 'BM',
    'Cayman Islands': 'KY', 'Luxembourg': 'LU', 'Jersey': 'JE', 'Guernsey': 'GG', 'Isle of Man': 'IM',
    'Uruguay': 'UY', 'Argentina': 'AR', 'Chile': 'CL', 'Peru': 'PE', 'Colombia': 'CO', 'Qatar': 'QA',
    'Kuwait': 'KW', 'Philippines': 'PH', 'Vietnam': 'VN', 'Viet Nam': 'VN', 'Turkey': 'TR',
    'Türkiye': 'TR', 'Turkiye': 'TR', 'Poland': 'PL', 'Austria': 'AT', 'Portugal': 'PT', 'Greece': 'GR',
    'Russia': 'RU', 'Russian Federation': 'RU', 'Czech Republic': 'CZ', 'Czechia': 'CZ', 'Hungary': 'HU',
    'Romania': 'RO', 'Egypt': 'EG', 'Nigeria': 'NG', 'Kenya': 'KE', 'Morocco': 'MA',
    'New Zealand': 'NZ', 'Kazakhstan': 'KZ', 'Bahrain': 'BH', 'Oman': 'OM', 'Puerto Rico': 'PR',
    'Panama': 'PA', 'Curacao': 'CW', 'Curaçao': 'CW', 'Macau': 'MO', 'Macao': 'MO',
    'Liechtenstein': 'LI', 'Monaco': 'MC', 'Cyprus': 'CY', 'Bahamas': 'BS', 'Marshall Islands': 'MH',
    'British Virgin Islands': 'VG', 'Virgin Islands, British': 'VG', 'Iceland': 'IS', 'Pakistan': 'PK',
    'Bangladesh': 'BD', 'Sri Lanka': 'LK', 'Slovakia': 'SK', 'Slovenia': 'SI', 'Croatia': 'HR',
    'Serbia': 'RS', 'Estonia': 'EE', 'Latvia': 'LV', 'Lithuania': 'LT', 'Malta': 'MT', 'Jordan': 'JO',
    'Gibraltar': 'GI', 'Ghana': 'GH', 'Tunisia': 'TN', 'Venezuela': 'VE', 'Costa Rica': 'CR',
    'Mauritius': 'MU', 'Zambia': 'ZM', 'Mongolia': 'MN', 'Georgia': 'GE', 'Ukraine': 'UA',
    'Faroe Islands': 'FO', 'Papua New Guinea': 'PG', 'Dominican Republic': 'DO', 'Guatemala': 'GT',
    'Ecuador': 'EC', 'Bolivia': 'BO', 'Paraguay': 'PY', 'Cambodia': 'KH', 'Myanmar': 'MM',
}


def country_code(name, unknown):
    if not name:
        return ''
    if len(name) == 2 and name.isupper():
        return name
    code = COUNTRY.get(name.strip())
    if code:
        return code
    unknown.add(name)
    return name


# ---------------------------------------------------------------- names

DROP_WORDS = set('''the inc incorporated corp corporation co company cos ltd limited llc lp plc sa sab
de cv nv bv se spa ag kgaa ab publ asa oyj as bhd berhad tbk pt pcl public jsc pjsc ojsc kk
class cl adr ads gdr reg registered share shares ord ordinary pref preferred non voting nv unitary
unit units holding holdings group grp temp com a b c h n'''.split())


# Kept when telling listings apart: SoftBank Group and SoftBank Corp., Heineken Holding and Heineken are
# different companies.
PARENT_WORDS = {'holding', 'holdings', 'group', 'grp'}


# Share-class tails: "Liberty Media Corporation - Series A Liberty Formula One", "Berkshire Hathaway Inc. New".
SERIES_TAIL = re.compile(r'\s+-\s+series\s+[a-z0-9]+\b.*$', re.I)


def norm(name, strict=False):
    s = unicodedata.normalize('NFKD', SERIES_TAIL.sub('', name or '')).encode('ascii', 'ignore').decode().lower()
    s = s.replace('&', ' and ').replace('.com', ' com ').replace('.', '')
    s = re.sub(r"[^a-z0-9]+", ' ', s)
    drop = DROP_WORDS - PARENT_WORDS if strict else DROP_WORDS
    words = [w for w in s.split() if w not in drop and w != 'and']
    if len(words) > 1 and words[-1] == 'new':
        words.pop()
    return ' '.join(words)


def num(x):
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    return x if x == x and abs(x) != float('inf') else None


# ---------------------------------------------------------------- TradingView

TV_URL = 'https://scanner.tradingview.com/global/scan'
TV_HEAD = {'Origin': 'https://www.tradingview.com', 'Referer': 'https://www.tradingview.com/'}
TV_COLS = ['name', 'description', 'country', 'sector', 'industry', 'market_cap_basic', 'close',
           'currency', 'change', 'Perf.W', 'Perf.1M', 'Perf.YTD', 'Perf.Y', 'total_revenue_ttm',
           'net_income_ttm', 'number_of_employees', 'exchange', 'type', 'subtype', 'typespecs',
           'is_primary', 'isin']
MARKETS = ['america', 'argentina', 'australia', 'austria', 'bahrain', 'bangladesh', 'belgium', 'brazil',
           'canada', 'chile', 'china', 'colombia', 'cyprus', 'czech', 'denmark', 'egypt', 'estonia',
           'finland', 'france', 'germany', 'greece', 'hongkong', 'hungary', 'iceland', 'india', 'indonesia',
           'ireland', 'israel', 'italy', 'japan', 'kenya', 'korea', 'ksa', 'kuwait', 'latvia', 'lithuania',
           'luxembourg', 'malaysia', 'mexico', 'morocco', 'netherlands', 'newzealand', 'nigeria', 'norway',
           'pakistan', 'peru', 'philippines', 'poland', 'portugal', 'qatar', 'romania', 'russia', 'serbia',
           'singapore', 'slovakia', 'rsa', 'spain', 'srilanka', 'sweden', 'switzerland', 'taiwan',
           'thailand', 'tunisia', 'turkey', 'uae', 'uk', 'venezuela', 'vietnam']
# Values that only make sense in US dollars; used to prove the conversion happened.
WATCH = []   # symbols to print raw screener fields for, when a company seems to be missing
ANCHORS = {'NASDAQ:AAPL': (1e12, 1.2e13), 'TSE:7203': (8e10, 1e12), 'KRX:005930': (1e11, 3e12),
           'NSE:RELIANCE': (5e10, 8e11), 'TWSE:2330': (2e11, 5e12), 'TADAWUL:2222': (6e11, 4e12)}


def tv_page(market, start, size, extra):
    """One page of a market, largest first. The screener converts the returned values to US dollars but
    filters and sorts in each listing's own currency, so the list is read market by market (one currency
    each, near enough) until the values fall well below the threshold."""
    body = {
        'columns': TV_COLS,
        'filter': [{'left': 'market_cap_basic', 'operation': 'egreater', 'right': 0}] + extra,
        'ignore_unknown_fields': True,
        'options': {'lang': 'en'},
        'price_conversion': {'to_currency': 'usd'},
        'range': [start, start + size],
        'sort': {'sortBy': 'market_cap_basic', 'sortOrder': 'desc'},
        'symbols': {},
    }
    j = json.loads(http('https://scanner.tradingview.com/%s/scan' % market, body, TV_HEAD, tries=2))
    if j.get('error'):
        raise RuntimeError(str(j['error'])[:200])
    rows = []
    for d in j.get('data') or []:
        v = dict(zip(TV_COLS, d.get('d') or []))
        v['s'] = d.get('s')
        v['mk'] = market
        rows.append(v)
    return rows


def probe():
    """Raw screener fields for a few symbols, to explain any that are missing from the list."""
    if not WATCH:
        return
    body = {'symbols': {'tickers': WATCH}, 'columns': TV_COLS, 'ignore_unknown_fields': True,
            'price_conversion': {'to_currency': 'usd'}, 'options': {'lang': 'en'}}
    try:
        j = json.loads(http(TV_URL, body, TV_HEAD, tries=1))
    except Exception as e:
        log('probe failed:', e)
        return
    for d in j.get('data') or []:
        v = dict(zip(TV_COLS, d.get('d') or []))
        log('probe %-16s %s/%s primary=%s cap=%s %s' % (d.get('s'), v.get('type'), v.get('subtype'), v.get('is_primary'),
                                                    '%.3g' % v['market_cap_basic'] if num(v.get('market_cap_basic')) else v.get('market_cap_basic'),
                                                    (v.get('description') or '')[:36]))


GAPS = []


def crosscheck(rows):
    """Names companiesmarketcap.com lists at $15B+ that the screener list lacks (diagnostic only)."""
    try:
        txt = http('https://companiesmarketcap.com/?download=csv', headers={'Accept': 'text/csv,*/*'}, tries=1)
    except Exception as e:
        log('crosscheck skipped:', e)
        return
    have = [set(norm(r['n']).split()) for r in rows]
    missing = []
    for r in csv.DictReader(io.StringIO(txt)):
        m = num(r.get('marketcap'))
        if m is None or m < 15e9:
            continue
        t = set(norm(r.get('Name')).split())
        if t and not any(t <= h or h <= t for h in have if h):
            missing.append('%s (%s, %.0fB)' % (r.get('Name'), r.get('country'), m / 1e9))
    log('crosscheck: %d names at $15B+ on companiesmarketcap not found here (see status.json)' % len(missing))
    GAPS.extend(missing)


# Lines that are not ordinary shares: preference shares, depositary shares, certificates, notes.
NOT_COMMON = re.compile(r'\b(pref|prefs|pfd|preferred|preference|depositary|dep shs|non[- ]?cum|cum|cumulative|perp|'
                        r'perpetual|notes?|debentures?|bonds?|partizipsch\w*|genussch\w*|participation|cdrs?|'
                        r'rights?|warrants?|units?|subordinated)\b|%', re.I)
RESCUED = []


def read_market(market, extra, size=300):
    """Pages of one market, largest first, until values drop well below the threshold."""
    out, start = [], 0
    while True:
        batch = tv_page(market, start, size, extra)
        out += batch
        usd = [m for m in (num(v.get('market_cap_basic')) for v in batch) if m is not None]
        if len(batch) < size or not usd or min(usd) < READ_MIN * 0.6 or start >= 6000:
            return out
        start += size
        time.sleep(0.25)


def tradingview(amap=None):
    """Two passes per market: listings the screener marks as primary, then the home country's listings it
    marks as secondary (it gets a few big ones wrong, such as Roche and Intesa Sanpaolo). Secondary
    listings of foreign companies, which run to thousands in Germany alone, are never read."""
    raw, failed = {}, []
    for market in MARKETS:
        try:
            first = read_market(market, [{'left': 'is_primary', 'operation': 'equal', 'right': True}])
        except Exception as e:
            failed.append(market)
            log('  %s: %s' % (market, e))
            continue
        for v in first:
            v['pri'] = True
            raw.setdefault(v['s'], v)
        big = [v for v in first if (num(v.get('market_cap_basic')) or 0) >= READ_MIN]
        homes = {}
        for v in big or first:
            if v.get('country'):
                homes[v['country']] = homes.get(v['country'], 0) + 1
        home = max(homes, key=homes.get) if homes else None
        extra, second = 0, []
        venues = {v['s'].split(':')[0] for v in first}
        if home:
            time.sleep(0.25)
            try:
                second = read_market(market, [{'left': 'is_primary', 'operation': 'equal', 'right': False},
                                              {'left': 'country', 'operation': 'equal', 'right': home},
                                              {'left': 'type', 'operation': 'equal', 'right': 'stock'},
                                              {'left': 'subtype', 'operation': 'nequal', 'right': 'preferred'}])
            except Exception as e:
                second = []
                log('  %s (secondary pass): %s' % (market, e))
            for v in second:
                if v['s'] in raw or v.get('type') != 'stock' or v.get('subtype') == 'preferred':
                    continue
                if v['s'].split(':')[0] not in venues or NOT_COMMON.search(v.get('description') or ''):
                    continue
                v['pri'] = False
                raw[v['s']] = v
                if (num(v.get('market_cap_basic')) or 0) >= READ_MIN:
                    extra += 1
        if big or extra:
            log('  %-12s %4d primary (%d read), %3d more from %s (%d read)' % (market, len(big), len(first), extra, home,
                                                                          len(second) if home else 0))
        time.sleep(0.25)
    raw = list(raw.values())
    log('tradingview: %d markets read, %d failed%s' % (len(MARKETS) - len(failed), len(failed),
                                                       (' (' + ', '.join(failed) + ')') if failed else ''))
    if len(failed) > len(MARKETS) // 3:
        raise RuntimeError('too many markets failed')

    # Which columns came back empty everywhere (renamed or unknown fields)?
    empty = [c for c in TV_COLS if all(r.get(c) in (None, '', []) for r in raw)]
    if empty:
        log('tradingview: columns with no data:', ', '.join(empty))
    by = {r['s']: r for r in raw}
    bad = []
    for sym, (lo, hi) in ANCHORS.items():
        r = by.get(sym)
        m = num(r and r.get('market_cap_basic'))
        log('anchor %-14s %s' % (sym, 'missing' if m is None else '%.3g' % m))
        if m is not None and not (lo <= m <= hi):
            bad.append(sym)
    if bad:
        raise RuntimeError('values not in US dollars for ' + ', '.join(bad))
    if sum(1 for s in ANCHORS if s in by) < 3:
        raise RuntimeError('too few anchor companies found to trust the list')

    types = {}
    for r in raw:
        k = '%s/%s' % (r.get('type'), r.get('subtype'))
        types[k] = types.get(k, 0) + 1
    log('types:', json.dumps(types, sort_keys=True))

    unknown = set()
    rows = []
    for r in raw:
        t = r.get('type')
        specs = r.get('typespecs') or []
        if t not in ('stock', 'dr') and not (t == 'fund' and 'reit' in specs):
            continue
        if r.get('subtype') in ('etf', 'mutual', 'trust', 'unit') or 'etf' in specs:
            continue
        m = num(r.get('market_cap_basic'))
        if m is None or m < READ_MIN:
            continue
        rows.append({
            's': r['s'], 'n': (r.get('description') or r.get('name') or '').strip(),
            'cc': country_code(r.get('country'), unknown), 'sec': r.get('sector') or '',
            'ind': r.get('industry') or '', 'm': m, 'px': num(r.get('close')),
            'd1': num(r.get('change')), 'w1': num(r.get('Perf.W')), 'm1': num(r.get('Perf.1M')),
            'ytd': num(r.get('Perf.YTD')), 'y1': num(r.get('Perf.Y')),
            'rev': num(r.get('total_revenue_ttm')), 'ni': num(r.get('net_income_ttm')),
            'emp': num(r.get('number_of_employees')), 'dr': t == 'dr', 'pri': r.get('pri', True),
            'isin': r.get('isin') if isinstance(r.get('isin'), str) else None,
        })
    if unknown:
        log('countries without a code:', ', '.join(sorted(unknown)))
    return dedupe(rows, amap)


TEMP = re.compile(r'\bTEMP\b')


def dedupe(rows, amap=None):
    """One row per company: drop extra share classes and second listings of the same name and country.
    Shares beat depositary receipts and preference lines, primary listings beat secondary ones, a line the
    hand-built atlas uses beats another class of the same company, then the larger value wins."""
    amap = amap or {}
    rows.sort(key=lambda r: (r.get('dr', False), bool(NOT_COMMON.search(r['n'])), not r.get('pri', True),
                             bool(TEMP.search(r['n'])), r['s'] not in amap, -r['m']))
    seen, out, dropped, near = {}, [], [], {}
    for r in rows:
        name = norm(r['n'], strict=True)
        key = (r['cc'], name)
        twin = seen.get(key)
        secondary = r.get('dr') or not r.get('pri', True) or NOT_COMMON.search(r['n'])
        if twin is None and secondary:
            # Another line of a company already listed: same country, same first word, same value.
            for q in near.get((r['cc'], (name.split() or [''])[0]), []):
                if abs(q['m'] - r['m']) <= 0.002 * q['m']:
                    twin = q
                    break
        if twin is not None:
            twin.setdefault('alt', []).append(r['s'])
            dropped.append(r['s'])
            continue
        seen[key] = r
        near.setdefault((r['cc'], (name.split() or [''])[0]), []).append(r)
        out.append(r)
    if dropped:
        log('merged %d extra listings, e.g. %s' % (len(dropped), ', '.join(dropped[:12])))
    out.sort(key=lambda r: -r['m'])
    return out



# ---------------------------------------------------------------- names and ids

# Legal forms and share classes at the end of a listing's name: "Toyota Tsusho Corp." -> "Toyota Tsusho".
TAIL = re.compile(r'(?:[\s,.-]+(?:class [a-z]|cl [a-z]|series [a-z0-9]+|reg s|-h-|h shares?|a shares?|units?|'
                  r'co\.?,? ltd\.?|company limited|co\.? limited|corporation|corp\.?|incorporated|inc\.?|limited|ltd\.?|'
                  r'l\.?l\.?c\.?|p\.?l\.?c\.?|s\.?a\.?b\.? de c\.?v\.?|sab de cv|de c\.?v\.?|s\.?a\.?|s\.?p\.?a\.?|a\.?g\.?|n\.?v\.?|se|ab|'
                  r'\(publ\)|asa|oyj|a/s|as|tbk|pcl|public company limited|public co\.?,? ltd\.?|bhd\.?|berhad|jsc|pjsc|'
                  r'k\.?k\.?|co\.?|new|the))+\s*$', re.I)


def clean_name(n):
    n = SERIES_TAIL.sub('', re.sub(r'\s+', ' ', (n or '').strip()))
    n = re.sub(r'^PT\s+', '', n)
    n = re.sub(r'\s*\(The\)\s*$', '', n, flags=re.I)
    prev = None
    while prev != n:
        prev = n
        n = TAIL.sub('', n).strip(' ,.-')
    if n.isupper() and len(n) > 5:
        n = ' '.join(w if len(w) <= 4 else w.capitalize() for w in n.split())
    return n or prev


def slug(s):
    words = re.sub(r'[^a-z0-9]+', ' ', unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()).split()
    out = ''
    for w in words:
        if out and len(out) + 1 + len(w) > 32:
            break
        out = out + '_' + w if out else w[:32]
    return out or 'company'


def curated_ids():
    ids = set()
    for f in os.listdir(DATA_DIR):
        if re.match(r'nodes\d+\.js$', f):
            for m in re.finditer(r'^\s*\[\s*"([a-z0-9_]+)"\s*,', open(os.path.join(DATA_DIR, f), encoding='utf-8').read(), re.M):
                ids.add(m.group(1))
    return ids


def new_id(name, sym, taken):
    base = slug(clean_name(name))
    for cand in (base, base + '_' + slug(sym.split(':')[0]), base + '_' + slug(sym)):
        if cand not in taken:
            return cand
    i = 2
    while '%s_%d' % (base, i) in taken:
        i += 1
    return '%s_%d' % (base, i)


# ---------------------------------------------------------------- state

def load(name, default):
    try:
        with open(os.path.join(LIVE, name), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def save(name, obj, pretty=False):
    os.makedirs(LIVE, exist_ok=True)
    with open(os.path.join(LIVE, name), 'w', encoding='utf-8') as f:
        if pretty:
            json.dump(obj, f, ensure_ascii=False, indent=1, sort_keys=True)
        else:
            json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')


def days(a, b):
    try:
        return (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days
    except (TypeError, ValueError):
        return 0


def update_universe(rows, amap):
    """Adds companies worth ADD_MIN or more that the hand-built atlas does not already hold; keeps members
    through dips; drops them after DROP_DAYS_LOW days below READ_MIN or DROP_DAYS_GONE days unseen."""
    uni = load('universe.json', {'v': 1, 'members': {}})
    mem = uni.setdefault('members', {})
    taken = curated_ids() | {m['id'] for m in mem.values()}
    by = {r['s']: r for r in rows}
    alt = {}
    for r in rows:
        for s in r.get('alt', []):
            alt[s] = r
    today = TODAY.isoformat()
    added, dropped = [], []
    merged = []
    for sym in list(mem):
        if sym in by or sym not in alt:
            continue
        keep = alt[sym]['s']
        if keep not in mem and keep not in amap:
            mem[keep] = mem.pop(sym)         # the company's main line changed: it keeps its id
        else:
            mem.pop(sym)                     # another class or listing of a company already in the atlas
            merged.append(sym)
    if merged:
        log('universe: %d extra share lines removed, e.g. %s' % (len(merged), ', '.join(merged[:8])))
    for sym, m in list(mem.items()):
        r = by.get(sym)
        if sym in amap:                      # now part of the hand-built atlas
            mem.pop(sym)
            continue
        if r is None:
            if days(m.get('seen'), today) > DROP_DAYS_GONE:
                dropped.append(sym)
                mem.pop(sym)
            continue
        m['seen'] = today
        m.update({'n': r['n'], 'cc': r['cc'], 'sec': r['sec'], 'ind': r['ind']})
        if r.get('isin'):
            m['isin'] = r['isin']
        if r['m'] < READ_MIN * 1.0001:
            m.setdefault('low', today)
            if days(m['low'], today) > DROP_DAYS_LOW:
                dropped.append(sym)
                mem.pop(sym)
        else:
            m.pop('low', None)
    for r in rows:
        if r['m'] >= ADD_MIN and r['s'] not in mem and r['s'] not in amap and not any(s in amap for s in r.get('alt', [])):
            i = new_id(r['n'], r['s'], taken)
            taken.add(i)
            mem[r['s']] = {'id': i, 'n': r['n'], 'cc': r['cc'], 'sec': r['sec'], 'ind': r['ind'], 'since': today, 'seen': today}
            if r.get('isin'):
                mem[r['s']]['isin'] = r['isin']
            added.append(r['s'])
    uni['updated'] = today
    log('universe: %d companies (%d added, %d dropped today)' % (len(mem), len(added), len(dropped)))
    if added[:8]:
        log('  added e.g. ' + ', '.join(mem[s]['n'] for s in added[:8]))
    return uni, added, dropped


# ---------------------------------------------------------------- output

COLS = ['s', 'n', 'cc', 'sec', 'ind', 'm', 'px', 'd1', 'w1', 'm1', 'ytd', 'y1', 'rev', 'ni', 'emp', 'a']


def sig(x, digits=4):
    if x is None:
        return None
    if x == 0:
        return 0
    return float('%.*g' % (digits, x))


def write(rows, uni, amap, checks):
    ids = {s: a for s, a in amap.items()}
    ids.update({s: m['id'] for s, m in uni['members'].items()})
    keep = []
    for r in rows:
        a = ids.get(r['s']) or next((ids[s] for s in r.get('alt', []) if s in ids), None)
        if a:
            r['a'] = a
            keep.append(r)
    sectors = sorted({r['sec'] for r in keep if r['sec']})
    industries = sorted({r['ind'] for r in keep if r['ind']})
    si = {s: i for i, s in enumerate(sectors)}
    ii = {s: i for i, s in enumerate(industries)}
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    names = {v: k for k, v in COUNTRY.items() if len(k) > 3}
    names.update({'US': 'United States', 'GB': 'United Kingdom', 'KR': 'South Korea', 'AE': 'United Arab Emirates',
                  'TR': 'Turkey', 'RU': 'Russia', 'CZ': 'Czech Republic', 'VN': 'Vietnam', 'CW': 'Curaçao',
                  'MO': 'Macau', 'VG': 'British Virgin Islands'})
    out_rows = [[r['s'], r['n'], r['cc'], si.get(r['sec'], -1), ii.get(r['ind'], -1), round(r['m'] / 1e6),
                 sig(r.get('px')), sig(r.get('d1'), 3), sig(r.get('w1'), 3), sig(r.get('m1'), 3), sig(r.get('ytd'), 3),
                 sig(r.get('y1'), 3), None if r.get('rev') is None else round(r['rev'] / 1e6),
                 None if r.get('ni') is None else round(r['ni'] / 1e6), None if r.get('emp') is None else int(r['emp']),
                 r['a']] for r in keep]
    doc = {'v': 1, 'asOf': now.isoformat().replace('+00:00', 'Z'), 'source': 'TradingView screener',
           'units': 'm, rev and ni in US$ millions; px in US$; d1 w1 m1 ytd y1 are % changes',
           'threshold': ADD_MIN, 'floor': READ_MIN, 'count': len(keep),
           'matched': sum(1 for r in keep if r['a'] in amap.values()), 'cols': COLS,
           'sectors': sectors, 'industries': industries,
           'countries': {c: names.get(c, c) for c in sorted({r['cc'] for r in keep})}, 'rows': out_rows}
    save('markets.json', doc)
    status = {'ok': True, 'asOf': doc['asOf'], 'count': len(keep), 'universe': len(uni['members']),
              'total_usd_tn': round(sum(r['m'] for r in keep) / 1e12, 2), 'checks': checks,
              'unmatched_names_elsewhere': GAPS, 'log': LOG}
    save('status.json', status, pretty=True)
    log('wrote %d companies, %d KB' % (len(keep), os.path.getsize(os.path.join(LIVE, 'markets.json')) // 1024))


def main():
    try:
        with open(MAP_FILE, encoding='utf-8') as f:
            amap = json.load(f).get('symbols', {})
    except (OSError, ValueError):
        amap = {}
    try:
        rows = tradingview(amap)
    except Exception as e:
        log('TradingView failed: %r. Keeping the previous files.' % (e,))
        st = load('status.json', {})
        st.update({'ok': False, 'failedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'error': str(e)[:300]})
        save('status.json', st, pretty=True)
        return 0
    prev = load('markets.json', {})
    checks = {'count': len(rows), 'previous': prev.get('count')}
    if len(rows) < MIN_COUNT or (prev.get('count') and len(rows) < 0.65 * prev['count']):
        log('Only %d companies read; keeping the previous files.' % len(rows))
        return 0
    crosscheck([r for r in rows if r['m'] >= 15e9])
    uni, added, dropped = update_universe(rows, amap)
    checks.update({'added': len(added), 'dropped': len(dropped)})
    save('universe.json', uni, pretty=True)
    write(rows, uni, amap, checks)
    return 0


def annotate(code):
    """Repeat the log as one workflow annotation, readable from the run page and the Checks API."""
    if not os.environ.get('GITHUB_ACTIONS'):
        return
    text = '\n'.join(LOG[-60:]).replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
    print('::%s title=Market list::%s' % ('notice' if code == 0 else 'error', text), flush=True)


if __name__ == '__main__':
    try:
        rc = main()
    except Exception as e:  # report, then fail the run
        log('Unexpected error:', repr(e))
        rc = 1
    annotate(rc)
    sys.exit(rc)
