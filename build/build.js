// Build: validate data, project the world map, inline everything into one HTML file.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const req = f => require(path.join(DATA_DIR, f));
// every data/nodesN.js and data/linksN.js, in numeric order
const parts = re => fs.readdirSync(DATA_DIR).filter(f => re.test(f)).sort((a, b) => parseInt(a.replace(/\D/g, '')) - parseInt(b.replace(/\D/g, ''))).map(f => f.replace(/\.js$/, ''));
const nodesRaw = parts(/^nodes\d+\.js$/).flatMap(req);
const linksRaw = parts(/^links\d+\.js$/).flatMap(req);
console.log('data files:', parts(/^nodes\d+\.js$/).join(' '), '|', parts(/^links\d+\.js$/).join(' '));
const graveyard = req('graveyard');
const stories = req('stories');
const countries = req('countries');

const errors = [];
const ids = new Map();
for (const n of nodesRaw) {
  if (n.length !== 10) errors.push('node length ' + n[0]);
  if (ids.has(n[0])) errors.push('dup node ' + n[0]);
  ids.set(n[0], n);
  if (!countries[n[2]]) errors.push('unknown country ' + n[2] + ' for ' + n[0]);
  if (!(n[7] >= 1 && n[7] <= 5)) errors.push('bad tier ' + n[0]);
}
const KINDS = new Set(['acq', 'mrg', 'stk', 'inv', 'gov', 'jv', 'fnd', 'asset']);
const links = [];
for (const l of linksRaw) {
  let [s, t, y, e, p, k, v, note, flag, vt] = l;
  if (l.length !== 9 && l.length !== 10) errors.push('link length ' + s + '>' + t);
  const S = ids.get(s), T = ids.get(t);
  if (!S || !T) { errors.push('missing endpoint ' + s + '>' + t); continue; }
  // year null = the later founding year (founders and long-standing owners)
  if (y == null) y = Math.max(S[5], T[5]);
  // optional 10th field: voting power (%) where it differs from the stake, or "C" = controls, figure undisclosed
  if (vt != null && vt !== 'C' && !(typeof vt === 'number' && vt >= 0 && vt <= 100)) errors.push('bad votes ' + s + '>' + t + ' ' + vt);
  if (p != null && !(typeof p === 'number' && p > 0 && p <= 100)) errors.push('bad stake ' + s + '>' + t + ' ' + p);
  if (!KINDS.has(k)) errors.push('bad kind ' + k);
  if (!['', 'P', 'X'].includes(flag)) errors.push('bad flag ' + flag);
  if (y < S[5] || y < T[5]) errors.push('link before founding ' + s + '>' + t + ' ' + y);
  if ((S[6] && y > S[6]) || (T[6] && y > T[6])) errors.push('link after end ' + s + '>' + t + ' ' + y);
  // Normalise the active window: [y, e) ; one-off asset deals and same-year failures show for one year.
  if (k === 'asset') e = y + 1;
  if (e && e <= y) e = y + 1;
  links.push(vt != null ? [s, t, y, e || 0, p, k, v, note, flag, vt] : [s, t, y, e || 0, p, k, v, note, flag]);
}
for (const g of graveyard) {
  if (g.length !== 11) errors.push('graveyard length ' + g[1]);
  if (g[0] && !ids.has(g[0])) errors.push('graveyard node missing ' + g[0]);
  if (!countries[g[2]]) errors.push('graveyard country ' + g[2]);
}
for (const st of stories) for (const step of st.steps) for (const f of step.focus) if (!ids.has(f)) errors.push('story focus missing ' + st.id + ':' + f);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

// ---------- Listed companies and their owners, added automatically ----------
// live/universe.json   listed companies worth $3B+ from the daily market list, with stable ids
// live/wikidata.json   founding years, descriptions, websites and owners from Wikidata
// live/markets.json    today's figures (market value, revenue, profit, staff) for every listed company
// The workflow restores these from the published site before each build. Without them the atlas is the
// hand-built one only. Hand-built entities and links always win: the automatic layer only adds.
const LIVE = path.join(__dirname, '..', 'live');
const readLive = f => { const p = path.join(LIVE, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
const universe = (readLive('universe.json') || {}).members || {};
const wd = Object.assign({companies:{}, orgs:{}, rels:[]}, readLive('wikidata.json') || {});
const IMAP = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pipeline', 'industries.json'), 'utf8'));
const AMAP = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'atlas_map.json'), 'utf8'));
const amap = AMAP.symbols, qmap = AMAP.wikidata || {};
let markets = readLive('markets.json');
const YNOW = new Date().getUTCFullYear();
const ext = {};
const DROP = new Set('the inc incorporated corp corporation co company cos ltd limited llc lp plc sa sab de cv nv bv se spa ag kgaa ab publ asa oyj as bhd berhad tbk pt pcl public jsc pjsc ojsc kk class cl adr ads gdr reg registered share shares ord ordinary pref preferred non voting unitary unit units holding holdings group grp temp com a b c h n and of'.split(' '));
const GENERIC = new Set('bank banking china chinese india indian national international global energy power oil gas industries industrial insurance life financial finance capital investment investments corporation general united american japan japanese korea korean technology technologies electric electronics services resources mining development commercial securities telecom communications pharmaceutical pharmaceuticals real estate properties property construction engineering systems solutions foods food chemical chemicals materials enterprises trading new first'.split(' '));
const norm = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/\.com/g, ' com ').replace(/\./g, '').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w && !DROP.has(w));
const sameEntity = (a, b) => { const A = norm(a), B = new Set(norm(b)); return A.length > 0 && B.size > 0 && (A.join(' ') === [...B].join(' ') || A.some(w => w.length >= 3 && !GENERIC.has(w) && B.has(w))); };
const slugId = (s, taken) => { const w = norm(s).join(' ').replace(/[^a-z0-9 ]/g, '').split(' ').filter(Boolean); let out = ''; for (const x of w) { if (out && out.length + 1 + x.length > 32) break; out = out ? out + '_' + x : x.slice(0, 32); } out = out || 'org'; let id = out, i = 2; while (taken.has(id)) id = out + '_' + i++; return id; };
const TAIL = /(?:[\s,.-]+(?:class [a-z]|cl [a-z]|series [a-z0-9]+|reg s|-h-|units?|co\.?,? ltd\.?|company limited|corporation|corp\.?|incorporated|inc\.?|limited|ltd\.?|plc|s\.?a\.?b\.? de c\.?v\.?|sab de cv|s\.?a\.?|s\.?p\.?a\.?|a\.?g\.?|n\.?v\.?|se|ab|asa|oyj|a\/s|tbk|pcl|public company limited|public co\.?,? ltd\.?|bhd\.?|berhad|jsc|pjsc|new|the))+\s*$/i;
const cleanName = n => { let x = String(n || '').replace(/\s+/g, ' ').trim().replace(/^PT\s+/, '').replace(/\s*\(The\)\s*$/i, ''), prev = null; while (prev !== x) { prev = x; x = x.replace(TAIL, '').replace(/[\s,.-]+$/, '').trim(); } if (x === x.toUpperCase() && x.length > 5) x = x.split(' ').map(w => w.length <= 4 ? w : w[0] + w.slice(1).toLowerCase()).join(' '); return x || prev; };
const capFirst = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const theName = n => /^(?:United|Netherlands|Philippines|Bahamas|Gambia)|(?:Islands|Republic|Emirates|States|Kingdom)$/.test(n) ? 'the ' + n : n;
const mcapB = {};
if (markets && Array.isArray(markets.rows)) { const si = markets.cols.indexOf('s'), mi = markets.cols.indexOf('m'); for (const r of markets.rows) mcapB[r[si]] = r[mi] / 1000; }
const qToId = new Map();
for (const [sym, id] of Object.entries(amap)) { const c = wd.companies[sym]; if (c && c.q && ids.has(id)) qToId.set(c.q, id); }
const skipped = [];
const ownersOf = new Map();
for (const r of wd.rels) (ownersOf.get(r.t) || ownersOf.set(r.t, []).get(r.t)).push(r.s);
// listed companies
for (const [sym, m] of Object.entries(universe).sort((a, b) => (mcapB[b[0]] || 0) - (mcapB[a[0]] || 0))) {
  if (ids.has(m.id)) continue;
  let c = wd.companies[sym] || {};
  // Matched to an operating subsidiary whose parent is the listed holding company (Kirin Brewery for Kirin
  // Holdings, Fifth Third Bank for Fifth Third Bancorp): use the parent instead.
  if (c.q && c.l && norm(c.l).join(' ') !== norm(m.n).join(' ')) {
    const hold = (ownersOf.get(c.q) || []).find(q => wd.orgs[q] && norm(wd.orgs[q].l).join(' ') === norm(m.n).join(' '));
    if (hold) { const o = wd.orgs[hold]; c = {q:hold, l:o.l, d:o.d, f:o.f, cc:o.cc, w:c.w}; }
  }
  if (c.q && c.l && !sameEntity(c.l, m.n)) c = {};            // a doubtful Wikidata match: use none of it
  const cc = countries[m.cc] ? m.cc : c.cc && countries[c.cc] ? c.cc : null;
  if (!cc) { skipped.push(sym + ' (' + m.cc + ')'); continue; }
  const ind = IMAP.industry[m.ind] || IMAP.sector[m.sec] || 'grp';
  const name = c.l && c.l.length <= 60 ? c.l : cleanName(m.n);
  const f = c.f && c.f >= 1500 && c.f <= YNOW ? c.f : YNOW, v = mcapB[sym] || 0;
  const generic = !c.d || /^(?:[\w-]+ ){0,2}(?:company|corporation|business|enterprise|organi[sz]ation|firm|conglomerate|holding company)$/i.test(c.d.trim());
  const desc = !generic ? capFirst(c.d).replace(/\.?$/, '.') : `Listed company based in ${theName(countries[cc][0])}${m.ind ? ' (' + m.ind.toLowerCase() + ')' : ''}.`;
  const node = [m.id, name, cc, ind, 'pvt', f, 0, v >= 100 ? 3 : v >= 20 ? 2 : 1, desc, ''];
  nodesRaw.push(node); ids.set(m.id, node);
  ext[m.id] = Object.assign({s:sym}, c.q ? {q:c.q} : {}, f === YNOW && !c.f ? {fu:1} : {}, c.w ? {w:c.w} : {});
  if (c.q) qToId.set(c.q, m.id);
}
// owners: matched to hand-built entities where possible (states, families, funds), otherwise added
const typeOf = n => Array.isArray(n[4]) ? n[4][n[4].length - 1][1] : n[4];
// Hand-built names, with the aliases in brackets or after a slash: "Thomson family (Woodbridge)", "Naspers / Prosus".
const curatedByName = new Map();
const addName = (k, n) => { if (k && !curatedByName.has(k)) curatedByName.set(k, n); };
for (const n of nodesRaw) {
  if (ext[n[0]]) continue;
  addName(norm(n[1]).join(' '), n);
  const m = /^(.*?)\s*\((.+)\)\s*$/.exec(n[1]);
  if (m) { addName(norm(m[1]).join(' '), n); for (const a of m[2].split(/\s*(?:&|\/|,)\s*/)) addName(norm(a).join(' '), n); }
  if (n[1].includes(' / ')) for (const a of n[1].split(' / ')) addName(norm(a).join(' '), n);
}
// Wikidata items the hand-built atlas holds under another name (state bodies, sovereign funds, family holdings).
for (const [q, id] of Object.entries(qmap)) if (ids.has(id) && !qToId.has(q)) qToId.set(q, id);
// What kind of owner. "skip": not an owner at all (treasury shares, the free float, custodian and nominee banks).
// "state": the state itself (governments, ministries, state-asset agencies), one entity per country.
const PSEUDO = /\b(nominees?|custody|custodian|trustee services|master trust bank|trust (?:&|and) custody|treasury (?:stock|shares)|public float|free float|clearstream|euroclear|securities depository|depository trust|cede (?:&|and) co|hkscc|shareholders?|institutional investors?|employee stock ownership|public company|general public)\b/i;
const STATE_NAME = /^(?:the )?(?:government|state|kingdom|republic|commonwealth|federal government|federal republic|people's republic|socialist republic|union) of\b|^(?:the )?state treasury\b|\bministry\b|\bministries\b|\bstate council\b|state-owned assets supervision|\bsasac\b|agence des participations|sociedad estatal de participaciones|federal agency for state property|department of the treasury|council of ministers|central public administration/i;
const STATE_DESC = /\b(government ministry|executive department|national government|administrative bod(?:y|ies)|chief administrative authority|public authorities|represents the [a-z]+ state)\b/i;
const GOVLIKE = /\b(sovereign wealth|central bank|national bank of|development bank|investment authority|state holding|state fund|government pension|pension fund|provident fund|state agency|government agency|municipal|municipality|city of|largest city|city in|capital of|prefecture|province of|metropolis|county of)\b/i;
const PSU = /\b(state-owned|state owned|government-owned|government owned|state enterprise|public enterprise|public sector undertaking|owned by the government|crown corporation|federal public company)\b/i;
const FOUNDATION = /\b(foundation|charit\w*|non-?profit|trust fund|stiftung|fondation|fundaci\w*|cooperative|co-operative)\b/i;
const FUNDLIKE = /\b(investment (?:fund|company|firm|manager|management|trust)|asset manag\w*|private equity|venture capital|hedge fund|pension|mutual fund|investment holding|holding company|family office|wealth fund|endowment|capital management)\b/i;
function ownerKind(o) {
  const l = o.l || '', d = o.d || '';
  if (PSEUDO.test(l)) return 'skip';
  if (o.k === 'human') return 'human';
  if (o.iso || o.k === 'country') return 'state';
  // "French State", "Italian Government": a name ending in State or Government, described as the state
  if (STATE_NAME.test(l) || STATE_DESC.test(d) || (/\b(state|government)$/i.test(l) && /\b(state|government|public authorit|country|nation)/i.test(d))) return 'state';
  if (GOVLIKE.test(l + ' ' + d)) return 'gov';
  if (PSU.test(d)) return 'psu';
  if (FOUNDATION.test(l + ' ' + d)) return 'foundation';
  if (FUNDLIKE.test(l + ' ' + d)) return 'fund';
  return 'company';
}
const kindQ = new Map(Object.entries(wd.orgs).map(([q, o]) => [q, ownerKind(o)]));
// an owner that no longer exists (a dissolution date, or a closed span such as "(1892–2024)" in its description)
const ended = o => !!o.x || /\(\s*\d{3,4}\s*[–-]\s*\d{3,4}\s*\)/.test(o.d || '');
const KIND_OF = {human:['fam', 'grp'], gov:['gov', 'gov'], psu:['psu', 'grp'], fund:['fund', 'inv'], foundation:['fam', 'org'], company:['pvu', 'grp']};
let orgAdded = 0;
// The state of a country: the hand-built gov_xx entity when it stands for the state itself, otherwise one added here.
function stateOf(cc, o) {
  const g = ids.get('gov_' + cc.toLowerCase());
  if (g && !/\b(fund|bank|authority|corporation|investment)\b/i.test(g[1])) return g[0];
  const id = g ? 'gov_' + cc.toLowerCase() + '_state' : 'gov_' + cc.toLowerCase();
  if (!ids.has(id)) {
    const f = o && o.iso && o.f >= 1000 && o.f <= YNOW ? o.f : 1900;
    const node = [id, 'Government of ' + countries[cc][0], cc, 'gov', 'gov', f, 0, 1, '', ''];
    nodesRaw.push(node); ids.set(id, node); orgAdded++;
    ext[id] = Object.assign(o && o.iso ? {q:o.q} : {}, f === 1900 ? {fu:1} : {});
  }
  return id;
}
const used = new Set(wd.rels.filter(r => qToId.has(r.t) || wd.orgs[r.t]).map(r => r.s));
for (let pass = 0; pass < 3; pass++) for (const [q, o] of Object.entries(wd.orgs)) {   // repeated: owners of owners
  if (qToId.has(q) || !used.has(q)) continue;
  const kind = kindQ.get(q);
  if (kind === 'skip' || ended(o)) continue;
  if (!wd.rels.some(r => r.s === q && qToId.has(r.t))) continue;
  const cc = o.cc && countries[o.cc] ? o.cc : null;
  const hit = curatedByName.get(norm(o.l).join(' '));
  if (hit && (!cc || hit[2] === cc)) { qToId.set(q, hit[0]); continue; }
  if (kind === 'state') { if (cc) qToId.set(q, stateOf(cc, Object.assign({q}, o))); continue; }
  if (!cc || !o.l) continue;
  const [type, ind] = KIND_OF[kind] || KIND_OF.company;
  const id = slugId(o.l, ids);
  const f = o.f && o.f >= 1000 && o.f <= YNOW ? o.f : YNOW;
  const desc = o.d ? capFirst(o.d).replace(/\.?$/, '.') : '';
  const node = [id, o.l.length <= 60 ? o.l : o.l.slice(0, 57) + '…', cc, ind, type, f, 0, 1, desc, ''];
  nodesRaw.push(node); ids.set(id, node); qToId.set(q, id); orgAdded++;
  ext[id] = Object.assign({q}, f === YNOW && !o.f ? {fu:1} : {});
}
// ownership links from Wikidata: one per owner and company (a parent statement and a holding statement are merged)
const relBy = new Map();
for (const r of wd.rels) {
  const k = r.s + '>' + r.t, m = relBy.get(k);
  if (!m) { relBy.set(k, Object.assign({}, r)); continue; }
  if (r.k === 'parent') m.k = 'parent';
  if (r.p != null && (m.p == null || r.p > m.p)) m.p = r.p;
  if (r.y && (!m.y || r.y < m.y)) m.y = r.y;
}
const pairs = new Set(links.map(l => l[0] + '>' + l[1]));
let wdLinks = 0, undated = 0;
for (const r of relBy.values()) {
  const s = qToId.get(r.s), t = qToId.get(r.t);
  if (!s || !t || s === t || (!ext[s] && !ext[t]) || pairs.has(s + '>' + t) || pairs.has(t + '>' + s)) continue;
  const S = ids.get(s), T = ids.get(t), p = r.p != null ? Math.round(r.p * 100) / 100 : null;
  if (S[6] || T[6]) continue;                                   // a hand-built entity that no longer exists
  if (p != null && p < 10) continue;                            // small holdings
  if (r.k === 'owner' && p == null && typeOf(S) !== 'gov') continue;   // undisclosed holdings count only for a state
  const parent = r.k === 'parent', control = parent && (p == null || p > 50);
  // With a start date it is an event of that year: control bought, or a stake taken. Without one the link is
  // shown in the current year only, marked "year unknown" (the 11th field) and not counted as a deal.
  const dated = r.y && r.y >= S[5] && r.y >= T[5] && r.y <= YNOW;
  const kind = parent ? (dated ? (control ? 'acq' : 'stk') : 'fnd') : 'stk';
  const l = [s, t, dated ? r.y : YNOW, 0, p, kind, null, 'Wikidata', '', control ? 'C' : null];
  if (!dated) { l.push(1); undated++; }
  links.push(l); pairs.add(s + '>' + t); wdLinks++;
}
// a company the state controls is a public-sector company
for (const l of links) { const T = ids.get(l[1]); if (ext[l[1]] && T[4] === 'pvt' && typeOf(ids.get(l[0])) === 'gov' && (l[9] === 'C' || l[4] > 50)) T[4] = 'psu'; }
const extCount = Object.keys(ext).length;
console.log(`automatic layer: ${extCount} entities (${extCount - orgAdded} listed companies, ${orgAdded} owners), ${wdLinks} ownership links from Wikidata (${undated} without a start year)` + (skipped.length ? `; ${skipped.length} left out for want of a country: ${skipped.slice(0, 8).join(', ')}` : ''));
if (markets) {
  const ai = markets.cols.indexOf('a'); let cleared = 0;
  for (const r of markets.rows) if (r[ai] && !ids.has(r[ai])) { r[ai] = 0; cleared++; }
  console.log('market list:', markets.count, 'companies as of', markets.asOf + (cleared ? ` (${cleared} without an entity)` : ''));
}

// ---------- News (pipeline/news.py): the day's biggest moves with headlines, deal headlines that name an entity
// in the atlas, and market headlines, for the last 7 days ----------
let news = null;
try { news = JSON.parse(fs.readFileSync(path.join(LIVE, 'news.json'), 'utf8')); } catch (e) { news = null; }
if (news && news.v === 1) {
  // names to look for in headlines: the entity's name and the parts of a bracketed name, as whole words
  const STOP = new Set('american general national international united first global china india japan korea bank banco grupo royal capital energy power steel motor motors holdings group the new great state public life insurance industrial industries financial technologies technology systems communications pharmaceutical health airlines southern northern eastern western oil gas petroleum electric resources mining government family foundation fund trust investment investments partners nasdaq dow nyse sensex nifty'.split(' '));
  const mvBy = new Map(markets ? markets.rows.map(r => [r[markets.cols.indexOf('a')], r[markets.cols.indexOf('m')]]) : []);
  const names = new Map();              // lower-case phrase -> entity ids
  const put = (phrase, id) => { const k = phrase.toLowerCase().replace(/\s+/g, ' ').trim(); if (k.length < 3) return; (names.get(k) || names.set(k, new Set()).get(k)).add(id); };
  for (const n of nodesRaw) {
    const auto = ext[n[0]];
    if (auto && auto.s && !((mvBy.get(n[0]) || 0) >= 10000)) continue;   // added companies under $10B: too many look-alike names
    if (auto && !auto.s) continue;                                         // owners added from Wikidata
    const nm = cleanName(n[1]);
    const m = /^(.*?)\s*\((.+)\)\s*$/.exec(nm);
    const parts = m ? [m[1], ...m[2].split(/\s*(?:&|\/|,)\s*/)] : nm.split(' / ');
    for (const ph of [nm, ...parts]) {
      const x = ph.replace(/\s+(?:Inc|Corp|Co|Ltd|Plc|AG|SA|NV|SE|Group|Holdings?)\.?$/i, '').trim();
      if (x.length >= 3 && !STOP.has(x.toLowerCase())) put(x, n[0]);
    }
  }
  // One-word names that are also ordinary words in headlines ("Target", "Visa", "Sea", "Strategy", "News"):
  // these entities are found by a longer form of their name only.
  const COMMON_ONE = new Set('affirm ant ball block booking carnival carrier circle coherent compass continental crane crown cruise cursor disco discovery dover dow elm equitable eternal evolution fact flex fox freedom frontline grab hexagon mars metro news next nova orange orion partners progressive recruit sage screen sea sharp sky southern sprint strategy swift target times titan toast torrent travelers true urban visa waters wise'.split(' '));
  const phrases = [...names.keys()].filter(k => names.get(k).size === 1 && !COMMON_ONE.has(k)).sort((a, b) => b.length - a.length);
  const firstWord = new Map();
  for (const k of phrases) { const w = k.split(' ')[0]; (firstWord.get(w) || firstWord.set(w, []).get(w)).push(k); }
  // a one-word name must be written with a capital letter in the headline ("Apple", not "apple")
  const capital = (title, k) => {
    const lt = title.toLowerCase();
    for (let i = lt.indexOf(k); i >= 0; i = lt.indexOf(k, i + 1)) {
      if (!/[a-z0-9]/.test(lt[i - 1] || ' ') && !/[a-z0-9]/.test(lt[i + k.length] || ' ') && /[A-Z0-9]/.test(title[i])) return true;
    }
    return false;
  };
  // Longest names first, and a name found hides the shorter ones inside it ("Reliance Industries", not "Reliance").
  const find = title => {
    let t = ' ' + title.toLowerCase().replace(/[’']s\b/g, '').replace(/[^a-z0-9&.\- ]+/g, ' ').replace(/[.,-]+(?=\s)/g, '') + ' ';
    const cands = new Set();
    for (const w of new Set(t.split(/\s+/))) for (const k of firstWord.get(w) || []) cands.add(k);
    const out = new Set();
    for (const k of [...cands].sort((a, b) => b.length - a.length)) {
      if (!t.includes(' ' + k + ' ')) continue;
      if (!k.includes(' ') && !capital(title, k)) continue;
      out.add([...names.get(k)][0]);
      t = t.split(' ' + k + ' ').join(' ' + '_'.repeat(k.length) + ' ');
    }
    return [...out];
  };
  const safe = u => typeof u === 'string' && /^https?:\/\//.test(u) ? u : null;
  // the same filter as pipeline/news.py, for headlines stored before it existed
  const JUNK = /\b(?:form\s?(?:4|3|5|6-k|8-k|10-[kq]|13[dfg]|144|s-1|f-1)|sec (?:form|filing)|indicator by|strategy by|options? research recommendation|insider (?:buying|selling)|shares? (?:sold|bought|acquired) by|\d[\d,.]*\s+shares\s+of|stock position in|(?:new|raised|lowered|trimmed|boosted|cut|increased|reduced|grows|shrinks|lifts)\s+(?:its\s+)?(?:stake|position|holdings)\s+in|has \$[\d.,]+\s*(?:million|billion|[mbk])\s+(?:stock\s+)?(?:position|stake|holdings)\s+in)\b/i;
  const JUNK_SRC = new Set(['marketbeat', 'defense world', 'the ai journal', 'etf daily news', 'zolmax', 'tickerreport', 'the lincolnian online', 'the cerbat gem', 'the markets daily', 'modern readers', 'stocks register']);
  // one story told by many outlets: the same entities, and most of the same words
  const WORD_STOP = new Set('the and for with from that this into over after amid says said will could would its their about more than report reports reportedly talks deal deals news'.split(' '));
  const wordsOf = t => new Set(t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter(w => w.length >= 4 && !WORD_STOP.has(w)));
  const sameStory = (a, b) => {
    const ea = (a.e || []).slice().sort().join(','), eb = (b.e || []).slice().sort().join(',');
    if (!ea || ea !== eb) return false;
    if ((a.e || []).length >= 2) return true;
    const wa = wordsOf(a.t), wb = wordsOf(b.t); let n = 0; for (const w of wa) if (wb.has(w)) n++;
    return n / Math.max(1, wa.size + wb.size - n) >= 0.35;
  };
  const days = Object.keys(news.days || {}).sort().reverse().slice(0, 7);
  const byDay = new Map(days.map(d => [d, {d, moves:(news.days[d].moves || []).map(r => ({s:r.s, n:r.n, cc:r.cc, a:r.a && ids.has(r.a) ? r.a : 0, m:r.m, d1:r.d1, w1:r.w1, m1:r.m1, dv:r.dv})), items:[]}]));
  const perMover = new Map(); let kept = 0, dealsIn = 0, dealsKept = 0;
  for (const x of news.items || []) {
    const day = byDay.get(x.d), u = safe(x.u);
    if (!day || !u || !x.t || JUNK.test(x.t) || JUNK_SRC.has(String(x.src || '').toLowerCase())) continue;
    const it = {k:x.k, t:String(x.t).slice(0, 300), u, src:String(x.src || '').slice(0, 80), at:x.at || null};
    if (x.k === 'move') {
      const key = x.d + '|' + x.s, c = perMover.get(key) || 0;
      if (c >= 3 || !day.moves.some(r => r.s === x.s)) continue;
      perMover.set(key, c + 1); it.s = x.s;
    } else if (x.k === 'deal') {
      dealsIn++;
      const e = find(it.t);
      if (!e.length) continue;
      it.e = e.slice(0, 4);
      if (day.items.some(o => o.k === 'deal' && sameStory(o, it))) continue;      // newest first: keep the first telling
      dealsKept++;
    } else if (x.k === 'market') {
      const e = find(it.t); if (e.length) it.e = e.slice(0, 4);
    } else continue;
    day.items.push(it); kept++;
  }
  for (const day of byDay.values()) {
    const deals = day.items.filter(i => i.k === 'deal');
    if (deals.length > 30) { const drop = new Set(deals.slice(30)); day.items = day.items.filter(i => !drop.has(i)); kept -= drop.size; }
  }
  news = {updated:news.updated, days:[...byDay.values()]};
  console.log(`news: ${days.length} days, ${kept} headlines (${dealsKept} of ${dealsIn} deal headlines name an entity in the atlas)`);
} else news = null;

// ---------- Example connection paths (BFS over all links, undirected) ----------
const adj = new Map();
for (const [s, t] of links) { (adj.get(s) || adj.set(s, []).get(s)).push(t); (adj.get(t) || adj.set(t, []).get(t)).push(s); }
// multilateral lenders (IMF, World Bank, ADB...) connect every member state; keep them out of example routes
const multilateral = new Set(nodesRaw.filter(n => n[3] === 'org' && (Array.isArray(n[4]) ? n[4][n[4].length - 1][1] : n[4]) === 'gov').map(n => n[0]));
function bfs(a, b) {
  const prev = new Map([[a, null]]); const q = [a];
  while (q.length) { const x = q.shift(); if (x === b) break; for (const y of adj.get(x) || []) if (!prev.has(y) && (!multilateral.has(y) || y === b)) { prev.set(y, x); q.push(y); } }
  if (!prev.has(b)) return null; const p = []; for (let x = b; x; x = prev.get(x)) p.unshift(x); return p;
}
const examplePairs = [['amazon', 'reliance'], ['gov_us', 'jio'], ['bajaj_life', 'commerzbank'], ['gov_in', 'pif'], ['tata_sons', 'ford'], ['sbi', 'ms'], ['musk', 'alphabet'], ['lic', 'nvidia']]
  .map(([a, b]) => ({ a, b, path: bfs(a, b) })).filter(x => x.path && x.path.length >= 3 && x.path.length <= 7);
console.log('example paths:', examplePairs.map(x => x.path.join(' > ')).join('\n  '));

// ---------- Headquarters cities & map geometry ----------
const {cities, metroNames} = req('cities');
const hq = req('hq');
const cityKeys = Object.keys(cities), cityIdx = new Map(cityKeys.map((k, i) => [k, i]));
for (const [k, c] of Object.entries(cities)) {
  if (c.length < 5 || typeof c[2] !== 'number' || typeof c[3] !== 'number') errors.push('city shape ' + k);
  if (c[4] && !cities[c[4]]) errors.push('city metro missing ' + k);
  if (c[1] === 'IN' && !c[5]) errors.push('Indian city without state ' + k);
}
for (const n of nodesRaw) { if (ext[n[0]]) continue; if (!(n[0] in hq)) errors.push('no hq for ' + n[0]); else if (hq[n[0]] !== null && !cities[hq[n[0]]]) errors.push('hq city missing ' + n[0] + ':' + hq[n[0]]); }
for (const k of Object.keys(hq)) if (!ids.has(k)) errors.push('hq for unknown id ' + k);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
const geo = {world: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'geo', 'world.topo.json'), 'utf8')),
  india: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'geo', 'india.topo.json'), 'utf8'))};
for (const g of Object.values(geo)) { delete g.bbox; }
const ccs = new Set(); for (const gm of geo.world.objects[Object.keys(geo.world.objects)[0]].geometries) ccs.add(gm.properties.cc);
const noShape = Object.keys(countries).filter(cc => !ccs.has(cc));
if (noShape.length) console.log('countries without a shape (shown as markers):', noShape.join(' '));

// financial figures: merge bulk rankings with hand-compiled records (fin/build-fin.js)
require('child_process').execSync('node ' + JSON.stringify(path.join(__dirname, '..', 'fin', 'build-fin.js')), {stdio:'inherit'});
const fin = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fin', 'fin.json'), 'utf8'));
for (const id of Object.keys(fin)) if (!ids.has(id)) { console.error('fin id missing ' + id); process.exit(1); }

const DATA = {
  schema: 2,
  asOf: new Date().toISOString().slice(0, 10),
  builtAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  markets,
  news,
  ext,
  fin,
  nodes: nodesRaw,
  links,
  graveyard,
  stories,
  countries,
  examples: examplePairs.slice(0, 5).map(x => [x.a, x.b]),
  cities: cityKeys.map(k => [k, ...cities[k].slice(0, 4), cities[k][4] || '', cities[k][5] || '']),
  metroNames,
  hq: nodesRaw.map(n => hq[n[0]] == null ? -1 : cityIdx.get(hq[n[0]])),
  geo,
};
const json = JSON.stringify(DATA);
const tpl = fs.readFileSync(path.join(__dirname, '..', 'template.html'), 'utf8');
if (!tpl.includes('/*__DATA__*/')) { console.error('template placeholder missing'); process.exit(1); }
const engine = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8').replace(/\nif \(typeof module[^\n]*\n?$/, '\n');
if (!tpl.includes('/*__ENGINE__*/')) { console.error('engine placeholder missing'); process.exit(1); }
const out = tpl.replace('/*__DATA__*/', () => 'const DATA = ' + json.replace(/<\/script/gi, '<\\/script') + ';').replace('/*__ENGINE__*/', () => engine);
fs.mkdirSync(path.join(__dirname, '..', 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'dist', 'atlas.html'), out);
fs.writeFileSync(path.join(__dirname, '..', 'dist', 'data.json'), json); // the Android app downloads this
// The app's page: the same code without the data, which the app serves next to it (app/make-page.js).
fs.writeFileSync(path.join(__dirname, '..', 'dist', 'shell.html'), tpl.replace('/*__DATA__*/', () => 'const DATA = null;').replace('/*__ENGINE__*/', () => engine));
console.log('nodes', nodesRaw.length, 'links', links.length, 'graveyard', graveyard.length, 'stories', stories.length);
console.log('data KB', Math.round(json.length / 1024), 'html KB', Math.round(out.length / 1024));
