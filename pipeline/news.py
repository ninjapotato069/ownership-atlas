#!/usr/bin/env python3
"""Daily news for the atlas, kept for 7 days in live/news.json.

  moves    the day's biggest changes in market value (in dollars, from live/markets.json), with headlines
           about each company
  deals    headlines about acquisitions, mergers, stakes and buyouts (build/build.js keeps those that name an
           entity in the atlas)
  market   the day's market headlines

Headlines come from Google News search feeds (RSS), with Bing News feeds as a fallback. Only the headline, the
source's name, the time and the link are kept, never text from the articles; links open the original articles.

Usage: news.py. Network trouble never fails the run: whatever was collected is saved, and the previous days
stay as they were.
"""
import datetime as dt
import email.utils
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from markets import clean_name  # noqa: E402  (names without legal forms: "NVIDIA Corporation" -> "NVIDIA")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIVE = os.path.join(ROOT, 'live')
KEEP_DAYS = 7
MOVERS = 8               # biggest gains and biggest falls in dollars, each
PER_MOVER = 3            # headlines kept per company
MAX_DEALS = 120          # deal headlines collected per day, before matching
MAX_MARKET = 12
NOW = dt.datetime.now(dt.timezone.utc)
UA = 'Mozilla/5.0 (compatible; OwnershipAtlas/1.0; +https://github.com/ninjapotato069/ownership-atlas)'
LOG = []
BUDGET = 300             # seconds for all the feeds together; the refresh never waits longer on news
START = time.time()
FAILS = {}               # failures per feed host: after 3 the host is skipped for the rest of the run

DEAL_QUERIES = [
    'acquisition OR acquire OR takeover OR merger',
    '"agrees to buy" OR "to acquire" OR "deal to buy"',
    '"stake in" OR "stake sale" OR "buys stake" OR "sells stake"',
    'buyout OR "take private" OR "tender offer" OR "bid for"',
]
MARKET_QUERIES = ['"Wall Street" stocks', 'Sensex Nifty', '"European shares" OR "Asian shares"']
# Not news: filings, trading notices, holdings reports of funds ("XYZ LLC Acquires 1,234 Shares of ..."), indicators.
JUNK = re.compile(r'\b(?:form\s?(?:4|3|5|6-k|8-k|10-[kq]|13[dfg]|144|s-1|f-1)|sec (?:form|filing)|indicator by|strategy by|'
                  r'options? research recommendation|insider (?:buying|selling)|shares? (?:sold|bought|acquired) by|'
                  r'stock price, news|quote (?:&|and) history|stock forum|stock quote|live (?:stock|share) price|price today|'
                  r'\d[\d,.]*\s+shares\s+of|stock position in|'
                  r'(?:new|raised|lowered|trimmed|boosted|cut|increased|reduced|grows|shrinks|lifts)\s+(?:its\s+)?(?:stake|position|holdings)\s+in|'
                  r'has \$[\d.,]+\s*(?:million|billion|[mbk])\s+(?:stock\s+)?(?:position|stake|holdings)\s+in)\b', re.I)
JUNK_SOURCES = {'marketbeat', 'defense world', 'the ai journal', 'etf daily news', 'zolmax', 'tickerreport',
                'the lincolnian online', 'the cerbat gem', 'the markets daily', 'modern readers', 'stocks register'}
DEAL_WORDS = re.compile(r'\b(acqui\w*|takeover|take over|merger|merge[sd]?|buyout|buy-?out|stake|to buy|buys|buying|'
                        r'bid for|bids for|offer for|deal for|deal to|tender offer|take[- ]private|spin[- ]?off|'
                        r'divest\w*|sells? (?:its |a )?(?:unit|division|business|stake)|carve[- ]?out|ipo of)\b', re.I)


def log(*parts):
    line = ' '.join(str(p) for p in parts)
    LOG.append(line)
    print(line, flush=True)


def get(url, tries=2):
    host = urllib.parse.urlparse(url).hostname
    err = None
    for i in range(tries):
        if time.time() - START > BUDGET or FAILS.get(host, 0) >= 3:
            raise OSError('skipped (time budget spent or the host kept failing)')
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/rss+xml, application/xml'})
            with urllib.request.urlopen(req, timeout=15) as r:
                return r.read()
        except Exception as e:  # network trouble: try once more, then give up on this feed
            err = e
            FAILS[host] = FAILS.get(host, 0) + 1
            time.sleep(2 + 3 * i)
    raise err


def parse_rss(body):
    """Items of an RSS feed: title, link, source name, publication time."""
    out = []
    root = ET.fromstring(body)
    for it in root.iter('item'):
        title = (it.findtext('title') or '').strip()
        link = (it.findtext('link') or '').strip()
        src = ''
        for ch in it:
            if ch.tag == 'source' or ch.tag.endswith('}Source'):
                src = (ch.text or '').strip()
        when = it.findtext('pubDate') or ''
        try:
            at = email.utils.parsedate_to_datetime(when).astimezone(dt.timezone.utc)
        except (TypeError, ValueError):
            at = None
        if src and title.endswith(' - ' + src):
            title = title[:-(len(src) + 3)].rstrip()
        elif not src and ' - ' in title:
            title, src = title.rsplit(' - ', 1)
        if not title or not re.match(r'^https?://', link) or JUNK.search(title) or src.lower() in JUNK_SOURCES:
            continue
        out.append({'t': re.sub(r'\s+', ' ', title)[:300], 'u': link[:1000], 'src': src[:80],
                    'at': at.strftime('%Y-%m-%dT%H:%M:%SZ') if at else None})
    return out


def search(query, hours=30):
    """Headlines for a search, newest first, published within the last hours (Google News, then Bing News)."""
    feeds = [
        'https://news.google.com/rss/search?' + urllib.parse.urlencode(
            {'q': query + ' when:%dd' % max(1, round(hours / 24)), 'hl': 'en-US', 'gl': 'US', 'ceid': 'US:en'}),
        'https://www.bing.com/news/search?' + urllib.parse.urlencode({'q': query, 'format': 'rss', 'qft': 'interval="7"'}),
    ]
    for url in feeds:
        try:
            items = parse_rss(get(url))
        except Exception as e:
            log('  feed failed (%s): %s' % (url.split('/')[2], str(e)[:120]))
            continue
        cut = NOW - dt.timedelta(hours=hours)
        items = [x for x in items if not x['at'] or dt.datetime.strptime(x['at'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=dt.timezone.utc) >= cut]
        items.sort(key=lambda x: x['at'] or '', reverse=True)
        time.sleep(1.0)
        return items, url.split('/')[2]
    return [], None


def market_day(t):
    """The trading day a moment belongs to: the US Eastern date, the day before until the open, Friday at weekends."""
    try:
        from zoneinfo import ZoneInfo
        e = t.astimezone(ZoneInfo('America/New_York'))
    except Exception:
        e = t.astimezone(dt.timezone(dt.timedelta(hours=-5)))
    d = e.date()
    if (e.hour, e.minute) < (9, 30):
        d -= dt.timedelta(days=1)
    while d.weekday() > 4:
        d -= dt.timedelta(days=1)
    return d.isoformat()


def rekey(prev):
    """One time: days were stored under the date of the run (UTC), a day late for a run after the US close."""
    if not prev.get('days') or prev.get('key') == 'market-day':
        return prev
    last = {}
    for x in prev.get('items', []):
        if x.get('at') and x['at'] > last.get(x.get('d'), ''):
            last[x.get('d')] = x['at']
    to = {}
    for d in prev['days']:
        try:
            to[d] = market_day(dt.datetime.strptime(last[d][:19], '%Y-%m-%dT%H:%M:%S').replace(tzinfo=dt.timezone.utc))
        except (KeyError, ValueError):
            to[d] = d
    days = {}
    for d in sorted(prev['days']):            # the later run of the same trading day wins
        days[to[d]] = prev['days'][d]
    items, seen = [], set()
    for x in sorted(prev.get('items', []), key=lambda x: x.get('at') or '', reverse=True):
        k = key_of(x.get('t', ''))
        nd = to.get(x.get('d'), x.get('d'))
        if (nd, k) in seen:
            continue
        seen.add((nd, k))
        items.append(dict(x, d=nd))
    log('news: days re-keyed to the trading day: %s' % json.dumps(to))
    return dict(prev, days=days, items=items, key='market-day')


def key_of(title):
    """Same headline from two feeds or two searches: compare letters and digits only."""
    return re.sub(r'[^a-z0-9]+', '', title.lower())[:90]


def item_id(x):
    return hashlib.sha1((x['u'] + '|' + x['t']).encode('utf-8')).hexdigest()[:12]


def short_name(n):
    n = clean_name(n)
    n = re.sub(r'\s+(?:Inc|Corp|Co|Ltd|Plc|AG|SA|NV|SE)\.?$', '', n)
    return n


def mentions(title, name):
    """Does a headline name this company? The full short name, or its first word when it is distinctive."""
    t = title.lower()
    n = name.lower()
    if re.search(r'(?<![a-z0-9])' + re.escape(n) + r'(?![a-z0-9])', t):
        return True
    first = re.split(r'[\s,&-]+', n)[0]
    return len(first) >= 4 and first not in COMMON and re.search(r'(?<![a-z0-9])' + re.escape(first) + r'(?![a-z0-9])', t) is not None


COMMON = set('''american general national international united first global china india japan korea bank banco
grupo royal capital energy power steel motor motors holdings group the new great state public life insurance
industrial industries financial technologies technology systems communications pharmaceutical health airlines
southern northern eastern western oil gas petroleum electric resources mining'''.split())


def main():
    try:
        with open(os.path.join(LIVE, 'markets.json'), encoding='utf-8') as f:
            mk = json.load(f)
    except (OSError, ValueError) as e:
        log('news: no market list (%s); nothing to do' % e)
        return 0
    try:
        with open(os.path.join(LIVE, 'news.json'), encoding='utf-8') as f:
            prev = json.load(f)
    except (OSError, ValueError):
        prev = {}
    ci = {c: i for i, c in enumerate(mk['cols'])}
    prev = rekey(prev)
    try:
        day = market_day(dt.datetime.strptime(mk['asOf'][:19], '%Y-%m-%dT%H:%M:%S').replace(tzinfo=dt.timezone.utc))
    except (KeyError, TypeError, ValueError):
        day = market_day(NOW)

    # 1. the day's biggest moves in dollars: value change = value - value / (1 + change)
    rows = []
    for r in mk['rows']:
        m, d1 = r[ci['m']], r[ci['d1']]
        if m is None or d1 is None or d1 <= -99:
            continue
        rows.append({'s': r[ci['s']], 'n': short_name(r[ci['n']]), 'cc': r[ci['cc']], 'a': r[ci['a']] or None,
                     'm': m, 'd1': d1, 'w1': r[ci['w1']], 'm1': r[ci['m1']], 'dv': round(m - m / (1 + d1 / 100.0), 1)})
    gains = sorted((r for r in rows if r['dv'] > 0), key=lambda r: -r['dv'])[:MOVERS]
    falls = sorted((r for r in rows if r['dv'] < 0), key=lambda r: r['dv'])[:MOVERS]
    moves = gains + falls
    log('news for %s: biggest gain %s %+.0fB, biggest fall %s %+.0fB' % (
        day, gains[0]['n'] if gains else '-', gains[0]['dv'] / 1e3 if gains else 0,
        falls[0]['n'] if falls else '-', falls[0]['dv'] / 1e3 if falls else 0))

    items, seen, used = [], set(), {}
    def add(x, kind, sym=None):
        k = key_of(x['t'])
        if not k or k in seen:
            return False
        seen.add(k)
        x = dict(x, k=kind, d=day)
        if sym:
            x['s'] = sym
        x['id'] = item_id(x)
        items.append(x)
        return True

    # headlines kept from earlier runs today are not fetched again
    for x in prev.get('items', []):
        if x.get('d') == day:
            seen.add(key_of(x['t']))

    # 2. headlines about each mover
    for r in moves:
        got, host = search('"%s" stock' % r['n'], hours=30)
        used[host] = used.get(host, 0) + 1
        n = 0
        for x in got:
            if n >= PER_MOVER:
                break
            if mentions(x['t'], r['n']) and add(x, 'move', r['s']):
                n += 1
    # 3. deal headlines (matched to the atlas when it is built)
    deals = 0
    for q in DEAL_QUERIES:
        got, host = search(q, hours=30)
        used[host] = used.get(host, 0) + 1
        for x in got:
            if deals >= MAX_DEALS:
                break
            if DEAL_WORDS.search(x['t']) and add(x, 'deal'):
                deals += 1
    # 4. market headlines
    market = 0
    for q in MARKET_QUERIES:
        got, host = search(q, hours=30)
        used[host] = used.get(host, 0) + 1
        for x in got[:MAX_MARKET // len(MARKET_QUERIES)]:
            if add(x, 'market'):
                market += 1

    # 5. keep 7 days
    keep_from = (NOW - dt.timedelta(days=KEEP_DAYS)).date().isoformat()
    old = [x for x in prev.get('items', []) if x.get('d', '') >= keep_from]
    if not items and not moves:
        log('news: nothing collected; the previous file stays as it was')
        return 0
    days = {d: v for d, v in (prev.get('days') or {}).items() if d >= keep_from and d != day}
    days[day] = {'moves': moves}
    allitems = old + items
    allitems.sort(key=lambda x: (x.get('d', ''), x.get('at') or ''), reverse=True)
    doc = {'v': 1, 'key': 'market-day', 'updated': NOW.strftime('%Y-%m-%dT%H:%M:%SZ'), 'days': dict(sorted(days.items(), reverse=True)),
           'items': allitems,
           'note': 'Headlines from Google News and Bing News search feeds: the headline, source, time and link only. '
                   'Kept for %d days.' % KEEP_DAYS}
    os.makedirs(LIVE, exist_ok=True)
    tmp = os.path.join(LIVE, 'news.json.part')
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, os.path.join(LIVE, 'news.json'))
    log('news: %d new headlines today (%d about the %d biggest moves, %d deal headlines, %d market); feeds used %s; '
        '%d headlines over %d days in the file' % (len(items), len(items) - deals - market, len(moves), deals, market,
                                                   json.dumps({k: v for k, v in used.items() if k}), len(allitems), len(days)))
    return 0


def annotate():
    if not os.environ.get('GITHUB_ACTIONS'):
        return
    text = '\n'.join(LOG[-1:] + [x for x in LOG[:-1] if 'feed failed' not in x][:20])
    fails = sum(1 for x in LOG if 'feed failed' in x)
    if fails:
        text += '\n%d feed requests failed' % fails
    print('::notice title=News::%s' % text[:3800].replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A'), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:  # never fail the refresh over news
        log('news: unexpected error, previous file kept:', repr(e))
    annotate()
    sys.exit(0)
