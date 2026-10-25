// Merge bulk ranking figures (companiesmarketcap.com, last 12 months / market cap on 20 Oct 2026)
// with hand-compiled records into one object keyed by atlas id.
const fs = require('fs'), path = require('path');
const manual = {};
for (const f of fs.readdirSync(__dirname).filter(f => /^manual\d*\.js$/.test(f)).sort())
  for (const [k, v] of Object.entries(require(path.join(__dirname, f)))) {
    if (manual[k]) { console.error('fin: duplicate manual record ' + k + ' in ' + f); process.exit(1); }
    manual[k] = v;
  }
const D = p => require(path.join(__dirname, '..', 'data', p));
const N = fs.readdirSync(path.join(__dirname, '..', 'data')).filter(f => /^nodes\d+\.js$/.test(f)).flatMap(f => D(f));
const ids = new Set(N.map(n => n[0]));
const cmc = {};
for (const f of fs.readdirSync(__dirname).filter(f => /^cmc_.*\.txt$/.test(f)))
  for (const line of fs.readFileSync(path.join(__dirname, f), 'utf8').split('\n')) {
    const m = line.match(/^([REMP]) (\S+) ([\d.-]+)/); if (!m) continue;
    const o = cmc[m[2]] = cmc[m[2]] || {};
    const key = { R: 'r', E: 'p', M: 'm', P: 'e' }[m[1]];
    if (o[key] == null) o[key] = +m[3];
  }
const out = {}, problems = [];
const round = (x, d = 3) => x == null ? x : Math.round(x * 10 ** d) / 10 ** d;
for (const id of new Set([...Object.keys(cmc), ...Object.keys(manual)])) {
  if (!ids.has(id)) { problems.push('unknown id ' + id); continue; }
  const c = cmc[id] || {}, m = manual[id] || {};
  const rec = {}, src = {};
  // bulk figures first
  for (const k of ['r', 'p', 'm', 'e']) if (c[k] != null && !(m.drop || []).includes(k)) { rec[k] = c[k]; src[k] = 'cmc'; }
  // rupee figures from filings convert at the year's average rate and replace bulk flows
  if (m.inr) {
    for (const k of ['r', 'p', 'n']) if (m.inr[k] != null) { rec[k] = round(m.inr[k] / (m.fx * 100)); src[k] = m.src || 'est'; }
    if (m.inr.n != null && m.inr.p == null) { delete rec.p; delete src.p; }
    rec.inr = m.inr; rec.fx = m.fx;
  }
  // hand-compiled numbers fill gaps only
  for (const k of ['r', 'p', 'n', 'm', 'v', 'e', 'a', 'aum', 'nw', 'gdp', 'pop'])
    if (m[k] != null && rec[k] == null && !(k === 'p' && rec.n != null && m.inr)) { rec[k] = round(m[k]); src[k] = m.src || 'est'; }
  if (rec.n != null && rec.p != null && src.p === 'cmc' && src.n !== 'cmc') { /* keep both: pre-tax (bulk) and net (filing) */ }
  for (const k of ['c', 's', 'w', 'note', 'per', 'rl', 'pl', 'sa']) if (m[k] != null) rec[k] = m[k];
  rec.src = src;
  out[id] = rec;
}
// sanity checks
for (const [id, r] of Object.entries(out)) {
  for (const k of ['r', 'p', 'n', 'm', 'v', 'a', 'aum', 'nw', 'gdp']) if (r[k] != null && !isFinite(r[k])) problems.push(id + ' bad ' + k);
  if (r.r != null && r.r <= 0) problems.push(id + ' non-positive revenue');
  if (r.p != null && r.r != null && Math.abs(r.p) > r.r * 1.2 && !r.note) problems.push(id + ' profit exceeds revenue: ' + r.p + ' vs ' + r.r);
  if (r.w && !ids.has(r.w)) problems.push(id + ' parent missing ' + r.w);
}
fs.writeFileSync(path.join(__dirname, 'fin.json'), JSON.stringify(out));
const T = n => Array.isArray(n[4]) ? n[4][n[4].length - 1][1] : n[4];
const live = N.filter(n => !n[6]);
const has = (id, k) => out[id] && out[id][k] != null;
const ops = live.filter(n => !['gov', 'fund', 'fam'].includes(T(n)));
const cnt = k => ops.filter(n => has(n[0], k)).length;
console.log('records', Object.keys(out).length, '| live operating', ops.length, '| with revenue', cnt('r'), '| profit', ops.filter(n => has(n[0], 'p') || has(n[0], 'n')).length, '| market value', cnt('m'), '| valuation', cnt('v'), '| employees', cnt('e'), '| customers', cnt('c'), '| inside parent', ops.filter(n => has(n[0], 'w')).length);
const bare = ops.filter(n => !out[n[0]] || (['r', 'p', 'n', 'm', 'v', 'e', 'c', 's', 'w', 'note'].every(k => out[n[0]][k] == null)));
console.log('no data at all:', bare.map(n => n[0]).join(' ') || 'none');
if (problems.length) console.log('PROBLEMS:\n' + problems.join('\n'));
