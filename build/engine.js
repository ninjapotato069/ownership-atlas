// Control & look-through ownership engine. Inlined into the page by build.js (and loaded by the tests in Node).
// Works on the page's data model: nodes {id, cc, ind, tier, f, e, types, out, inn} and links {s, t, y, e, p, k, flag, vt}.
//
// Control rules for an entity in a given year (holding links only: takeovers, stakes, funding, state rescues,
// joint ventures with a known stake and founder/parent links; announced and failed deals are ignored):
//   1. An owner marked as controlling the votes ("C") controls it.
//   2. Owners are grouped into blocks by their own ultimate controller (Samsung Life and Samsung C&T count as
//      one Lee-family block). Votes replace the economic stake where they differ (dual-class shares).
//   3. A block with more than 50% of the votes has majority control.
//   4. A takeover or state rescue with an undisclosed stake counts as control.
//   5. Otherwise the largest block controls in practice if it holds at least 30%, or 20% for a founder,
//      promoter or joint-venture partner or a block of affiliated holders, unless a second block that also
//      qualifies is within 5 points, or both blocks are founders, promoters or partners (joint control). Venture funding alone never
//      confers control.
//   6. Anything else is widely held (the largest holder is still reported).
// The ultimate controller is found by following controllers upward; chains stop at loops.
function makeEngine(o) {
  'use strict';
  var nodes = o.nodes, FIN = o.FIN || {};
  var OWNK = {acq: 1, stk: 1, inv: 1, gov: 1, jv: 1, fnd: 1};
  var CTRL_NULL = {acq: 1, gov: 1};
  var CONTROL = {majority: 1, votes: 1, control: 1, largest: 1};
  var memo = new Map();
  function atYear(Y) { var c = memo.get(Y); if (!c) { c = {}; memo.set(Y, c); if (memo.size > 40) memo.delete(memo.keys().next().value); } return c; }

  // Latest active holding link for each owner-owned pair.
  function holdings(Y) {
    var c = atYear(Y); if (c.h) return c.h;
    var best = new Map();
    for (var i = 0; i < nodes.length; i++) {
      var out = nodes[i].out;
      for (var j = 0; j < out.length; j++) {
        var l = out[j];
        if (!OWNK[l.k] || l.flag || (l.k === 'jv' && l.p == null) || l.s === l.t) continue;
        if (!o.activeAt(l, Y) || !o.alive(l.s, Y) || !o.alive(l.t, Y)) continue;
        var key = l.s.id + '>' + l.t.id, prev = best.get(key);
        if (!prev || l.y > prev.y || (l.y === prev.y && (l.p || 0) > (prev.p || 0))) best.set(key, l);
      }
    }
    var own = new Map(), hold = new Map();
    best.forEach(function (l) {
      var h = {s: l.s, t: l.t, l: l, p: l.p, vt: l.vt, k: l.k, w: typeof l.vt === 'number' ? l.vt : l.p};
      if (!own.has(l.t)) own.set(l.t, []); own.get(l.t).push(h);
      if (!hold.has(l.s)) hold.set(l.s, []); hold.get(l.s).push(h);
    });
    hold.forEach(function (a) { a.sort(function (x, y) { return (y.p || 0) - (x.p || 0); }); });
    return (c.h = {own: own, hold: hold});
  }
  // effective control: 30% of the votes, or 20% for a founder/promoter or for a block of affiliated holders
  var eff = function (b) { return b.w >= 30 || ((b.fnd || b.hs.length > 1) && b.w >= 20); };
  function leadOf(hs) { return hs.slice().sort(function (x, y) { return (y.w || 0) - (x.w || 0) || y.l.y - x.l.y; })[0]; }
  function decide(t, hs, ult) {
    if (!hs || !hs.length) return {how: 'none'};
    var c = hs.filter(function (h) { return h.vt === 'C'; });
    if (c.length) { var lc = leadOf(c); return {how: 'votes', lead: lc, pct: null, block: [lc]}; }
    var blocks = new Map();
    for (var i = 0; i < hs.length; i++) {
      var h = hs[i], key = ult.get(h.s) || h.s;
      if (key === t) continue; // its own subsidiaries holding its shares
      var b = blocks.get(key);
      if (!b) { b = {key: key, w: 0, fnd: false, invOnly: true, ctrlNull: null, hs: []}; blocks.set(key, b); }
      b.hs.push(h);
      if (h.w != null) b.w += h.w;
      if (h.p == null && h.vt == null && CTRL_NULL[h.k]) b.ctrlNull = h;
      if (h.k === 'fnd' || h.k === 'jv') b.fnd = true; // founders, promoters and joint-venture partners
      if (h.k !== 'inv') b.invOnly = false;
    }
    var arr = Array.from(blocks.values()).sort(function (a, b) { return b.w - a.w; });
    if (!arr.length) return {how: 'none'};
    var top = arr[0], second = arr[1];
    if (top.w > 50) return {how: 'majority', lead: leadOf(top.hs), pct: top.w, block: top.hs};
    var cn = arr.filter(function (b) { return b.ctrlNull; }).sort(function (a, b) { return b.ctrlNull.l.y - a.ctrlNull.l.y; })[0];
    if (cn) return {how: 'control', lead: cn.ctrlNull, pct: cn.w || null, block: cn.hs};
    if (!top.invOnly && eff(top)) {
      if (second && !second.invOnly && eff(second) && (second.w >= top.w - 5 || (top.fnd && second.fnd)))
        return {how: 'joint', lead: leadOf(top.hs), lead2: leadOf(second.hs), pct: top.w, pct2: second.w, block: top.hs, block2: second.hs};
      return {how: 'largest', lead: leadOf(top.hs), pct: top.w, block: top.hs};
    }
    return {how: top.w > 0 ? 'wide' : 'unknown', lead: top.w > 0 ? leadOf(top.hs) : null, pct: top.w || null, block: top.hs};
  }

  // Resolve controllers and ultimate controllers for a year (fixed-point over block membership).
  function solve(Y) {
    var c = atYear(Y); if (c.s) return c.s;
    var H = holdings(Y), live = nodes.filter(function (n) { return o.alive(n, Y); });
    var ult = new Map(), dec = new Map();
    live.forEach(function (n) { ult.set(n, n); });
    for (var it = 0; it < 14; it++) {
      var changed = false, next = new Map();
      for (var i = 0; i < live.length; i++) {
        var n = live[i], d = decide(n, H.own.get(n), ult), u = n;
        if (d.lead && CONTROL[d.how]) { var up = ult.get(d.lead.s) || d.lead.s; if (up === n) d.loop = true; else u = up; }
        dec.set(n, d); next.set(n, u);
        if (u !== ult.get(n)) changed = true;
      }
      ult = next;
      if (!changed) break;
    }
    var ctrl = new Map(), groups = new Map(), joint = new Map();
    live.forEach(function (n) {
      var d = dec.get(n);
      if (d.lead && CONTROL[d.how] && !d.loop) ctrl.set(n, d.lead.s);
      var r = ult.get(n);
      if (r !== n) { if (!groups.has(r)) groups.set(r, []); groups.get(r).push(n); }
      if (d.how === 'joint') [d.lead.s, d.lead2.s].forEach(function (p) { var rr = ult.get(p) || p; if (!joint.has(rr)) joint.set(rr, []); joint.get(rr).push(n); });
    });
    return (c.s = {Y: Y, live: live, dec: dec, ult: ult, ctrl: ctrl, groups: groups, joint: joint, H: H});
  }
  function chain(n, Y) {
    var S = solve(Y), out = [n], seen = new Set([n]), x = n;
    while (S.ctrl.has(x)) { x = S.ctrl.get(x); if (seen.has(x)) break; seen.add(x); out.push(x); }
    return out;
  }
  function ultimate(n, Y) { var S = solve(Y); return S.ult.get(n) || n; }

  // Value helpers: a listed company's market value, else a private valuation.
  function price(n) { var f = FIN[n.id]; if (!f || f.w) return null; return f.m != null ? f.m : f.v != null ? f.v : null; }
  function revenue(n) { var f = FIN[n.id]; return f && !f.w && f.r > 0 && !f.rl ? f.r : 0; }

  // Effective (look-through) stakes held by u in everything below it: sum over ownership paths of the product
  // of known stakes, eight levels deep. Undisclosed stakes are skipped.
  function effectiveFrom(u, Y) {
    var c = atYear(Y); c.ef = c.ef || new Map(); if (c.ef.has(u)) return c.ef.get(u);
    var hold = holdings(Y).hold, cur = new Map([[u, 1]]), tot = new Map();
    for (var d = 0; d < 8 && cur.size; d++) {
      var nx = new Map();
      cur.forEach(function (f, x) { (hold.get(x) || []).forEach(function (h) {
        if (h.p == null || h.t === u) return; var g = f * h.p / 100; if (g < 1e-5) return; nx.set(h.t, (nx.get(h.t) || 0) + g); }); });
      nx.forEach(function (g, t) { tot.set(t, Math.min(1, (tot.get(t) || 0) + g)); });
      cur = nx;
    }
    c.ef.set(u, tot); return tot;
  }
  // Who ultimately owns n: effective stakes of everyone above it.
  function effectiveOwners(n, Y) {
    var own = holdings(Y).own, cur = new Map([[n, 1]]), tot = new Map();
    for (var d = 0; d < 8 && cur.size; d++) {
      var nx = new Map();
      cur.forEach(function (f, x) { (own.get(x) || []).forEach(function (h) {
        if (h.p == null || h.s === n) return; var g = f * h.p / 100; if (g < 1e-5) return; nx.set(h.s, (nx.get(h.s) || 0) + g); }); });
      nx.forEach(function (g, s) { tot.set(s, Math.min(1, (tot.get(s) || 0) + g)); });
      cur = nx;
    }
    return tot;
  }
  // Value of what u owns: stake × market value (or private valuation), looking through unlisted, unpriced
  // holding companies; a priced company's own holdings are already in its price, so the walk stops there.
  function ownedValue(u, Y) {
    var c = atYear(Y); c.ov = c.ov || new Map(); if (c.ov.has(u)) return c.ov.get(u);
    var hold = holdings(Y).hold, total = 0, parts = new Map(), undisclosed = 0, path = new Set([u]);
    (function visit(x, f, depth) {
      (hold.get(x) || []).forEach(function (h) {
        var t = h.t; if (path.has(t)) return;
        if (h.p == null) { if (depth === 0) undisclosed++; return; }
        var g = f * h.p / 100; if (g < 1e-4) return;
        var pr = price(t);
        if (pr != null) { total += g * pr; parts.set(t, (parts.get(t) || 0) + g * pr); }
        else if (depth < 7) { path.add(t); visit(t, g, depth + 1); path.delete(t); }
      });
    })(u, 1, 0);
    var r = {total: total, parts: Array.from(parts, function (e) { return {t: e[0], v: e[1]}; }).sort(function (a, b) { return b.v - a.v; }), undisclosed: undisclosed};
    c.ov.set(u, r); return r;
  }
  // A group: everything whose ultimate controller is root. Revenue is counted once (a majority-owned
  // subsidiary whose parent in the group reports revenue is inside that parent's figure).
  function group(root, Y) {
    var S = solve(Y), c = atYear(Y); c.gr = c.gr || new Map(); if (c.gr.has(root)) return c.gr.get(root);
    var members = (S.groups.get(root) || []).slice(), all = [root].concat(members), inG = new Set(all);
    var rev = 0, mv = 0, cc = new Set(), inds = new Set(), listed = 0;
    all.forEach(function (n) {
      var f = FIN[n.id], d = S.dec.get(n), par = S.ctrl.get(n);
      if (n !== root || o.isCompany(n)) { cc.add(n.cc); inds.add(n.ind); }
      var consolidated = f && f.w ? true : !!(par && inG.has(par) && d && d.how === 'majority' && revenue(par) > 0 && !(FIN[par.id] || {}).sa);
      if (!consolidated) rev += revenue(n);
      var pr = price(n); if (pr != null && (n !== root || o.isCompany(n))) { mv += pr; listed++; }
    });
    var depth = 0; members.forEach(function (n) { var ch = chain(n, Y); var i = ch.indexOf(root); if (i > depth) depth = i; });
    var r = {root: root, members: members, joint: S.joint.get(root) || [], rev: rev, mv: mv, listed: listed, countries: cc, industries: inds, depth: depth};
    c.gr.set(root, r); return r;
  }
  function roots(Y) {
    var S = solve(Y), c = atYear(Y); if (c.roots) return c.roots;
    var out = [];
    S.groups.forEach(function (m, r) { out.push(group(r, Y)); });
    return (c.roots = out);
  }

  // Network power: an entity's own size plus a damped share of the power of everything it owns, in proportion
  // to its stakes (S = b + d·A·S). Size = square root of revenue plus a quarter of market value, or a small
  // amount by scale tier when there are no figures. Undisclosed controlling stakes count as half,
  // undisclosed minority stakes as 2%.
  function power(Y) {
    var c = atYear(Y); if (c.pw) return c.pw;
    var S = solve(Y), H = S.H, live = S.live, d = 0.85;
    var base = new Map(), score = new Map();
    live.forEach(function (n) { var f = FIN[n.id], v = f && !f.w ? (f.r || 0) + 0.25 * (f.m != null ? f.m : f.v || 0) : 0;
      var b = v > 0 ? Math.sqrt(v) : [0, 0.4, 0.8, 1.4, 2.2, 3.2][n.tier] * (o.isCompany(n) ? 1 : 0.3); base.set(n, b); score.set(n, b); });
    var w = function (h) { return h.p != null ? h.p / 100 : (h.vt === 'C' || CTRL_NULL[h.k]) ? 0.5 : 0.02; };
    for (var it = 0; it < 40; it++) {
      var nx = new Map();
      live.forEach(function (n) { var s = base.get(n); (H.hold.get(n) || []).forEach(function (h) { s += d * w(h) * (score.get(h.t) || 0); }); nx.set(n, s); });
      score = nx;
    }
    var arr = live.map(function (n) { return {n: n, s: score.get(n), own: base.get(n)}; }).sort(function (a, b) { return b.s - a.s; });
    var mx = arr.length ? arr[0].s : 1; arr.forEach(function (x, i) { x.idx = x.s / mx * 100; x.rank = i + 1; });
    var rank = new Map(arr.map(function (x) { return [x.n, x]; }));
    return (c.pw = {arr: arr, rank: rank});
  }

  // Brokers: betweenness centrality (Brandes) on the undirected network of active links in year Y.
  function brokers(Y) {
    var c = atYear(Y); if (c.bw) return c.bw;
    // entities without any link cannot broker anything; leaving them out keeps this quick on large datasets
    var live = nodes.filter(function (n) { return o.alive(n, Y) && (n.out.length || n.inn.length); }), idx = new Map(live.map(function (n, i) { return [n, i]; }));
    var adj = live.map(function () { return []; }), seen = new Set();
    live.forEach(function (n) { n.out.forEach(function (l) {
      if (l.flag === 'X' || l.k === 'asset' || l.k === 'mrg' || !o.activeAt(l, Y)) return;
      var a = idx.get(l.s), b = idx.get(l.t); if (a == null || b == null || a === b) return;
      var k = a < b ? a + ',' + b : b + ',' + a; if (seen.has(k)) return; seen.add(k); adj[a].push(b); adj[b].push(a); }); });
    var N = live.length, CB = new Float64Array(N), S = new Int32Array(N), P = [], sigma = new Float64Array(N), dist = new Int32Array(N), delta = new Float64Array(N), Q = new Int32Array(N);
    for (var s = 0; s < N; s++) {
      if (!adj[s].length) continue;
      var sp = 0; for (var i = 0; i < N; i++) { sigma[i] = 0; dist[i] = -1; delta[i] = 0; P[i] = null; }
      sigma[s] = 1; dist[s] = 0; var qh = 0, qt = 0; Q[qt++] = s;
      while (qh < qt) { var v = Q[qh++]; S[sp++] = v; var av = adj[v];
        for (var j = 0; j < av.length; j++) { var w2 = av[j];
          if (dist[w2] < 0) { dist[w2] = dist[v] + 1; Q[qt++] = w2; }
          if (dist[w2] === dist[v] + 1) { sigma[w2] += sigma[v]; (P[w2] || (P[w2] = [])).push(v); } } }
      while (sp > 0) { var x = S[--sp]; var px = P[x]; if (px) for (var k2 = 0; k2 < px.length; k2++) { var y = px[k2]; delta[y] += sigma[y] / sigma[x] * (1 + delta[x]); } if (x !== s) CB[x] += delta[x]; }
    }
    var arr = live.map(function (n, i) { return {n: n, b: CB[i] / 2, deg: adj[i].length}; }).sort(function (a, b) { return b.b - a.b; });
    var mx = arr.length && arr[0].b ? arr[0].b : 1; arr.forEach(function (x, i) { x.idx = x.b / mx * 100; x.rank = i + 1; });
    return (c.bw = {arr: arr, rank: new Map(arr.map(function (x) { return [x.n, x]; }))});
  }

  // How a company is ultimately held: state or private, domestic or foreign, or widely held.
  function holderClass(n, Y) {
    var S = solve(Y), d = S.dec.get(n), r = S.ult.get(n) || n, ty = o.typeAt(r, Y);
    if (r === n) {
      ty = o.typeAt(n, Y);
      if (ty === 'psu' || ty === 'gov') return 'state-dom';
      if (ty === 'fam') return 'priv-dom';
      return 'wide';
    }
    var st = ty === 'gov' || ty === 'psu';
    var dom = r.cc === n.cc;
    return (st ? 'state' : 'priv') + (dom ? '-dom' : '-for');
  }

  return {holdings: holdings, decide: decide, solve: solve, chain: chain, ultimate: ultimate, effectiveFrom: effectiveFrom,
    effectiveOwners: effectiveOwners, ownedValue: ownedValue, group: group, roots: roots, power: power, brokers: brokers,
    holderClass: holderClass, price: price, revenue: revenue, CONTROL: CONTROL,
    // Forget cached results, after market values change.
    reset: function () { memo.clear(); }};
}
if (typeof module !== 'undefined') module.exports = makeEngine;
