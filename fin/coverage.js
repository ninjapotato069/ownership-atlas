// Report which live entities have bulk figures (R revenue, E pre-tax, M market cap, P employees) and which are missing.
const fs = require('fs'), path = require('path');
const D = p => require(path.join(__dirname, '..', 'data', p));
const N = fs.readdirSync(path.join(__dirname, '..', 'data')).filter(f => /^nodes\d+\.js$/.test(f)).flatMap(f => D(f));
const T = n => Array.isArray(n[4]) ? n[4][n[4].length - 1][1] : n[4];
const got = {};
for (const f of fs.readdirSync(__dirname).filter(f => /^cmc_.*\.txt$/.test(f)))
  for (const line of fs.readFileSync(path.join(__dirname, f), 'utf8').split('\n')) {
    const m = line.match(/^([REMP]) (\S+) ([\d.-]+)/); if (!m) continue;
    (got[m[2]] = got[m[2]] || {})[m[1]] = +m[3];
  }
const ids = new Set(N.map(n => n[0]));
const unknown = Object.keys(got).filter(k => !ids.has(k)); if (unknown.length) console.log('UNKNOWN IDS:', unknown.join(' '));
const live = N.filter(n => !n[6] && !['gov', 'fund', 'fam'].includes(T(n)));
const miss = { full: [], partial: [], none: [] };
for (const n of live) {
  const g = got[n[0]] || {}; const k = ['R', 'E', 'M', 'P'].filter(x => g[x] == null);
  if (!k.length) miss.full.push(n[0]); else if (k.length === 4) miss.none.push(n[0] + '(' + T(n) + ')'); else miss.partial.push(n[0] + ':-' + k.join(''));
}
console.log('complete', miss.full.length, '| partial', miss.partial.length, '| none', miss.none.length);
console.log('PARTIAL:', miss.partial.join(' '));
console.log('NONE:', miss.none.join(' '));
