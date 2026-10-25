// Hand-compiled figures for the second batch added on 21 Oct 2026 (new industries and organisations).
// Same fields and units as manual.js: US$ billions; `inr` in ₹ crore converted at `fx`.
const FY24 = 82.8;
module.exports = {
  tether: { n: 13, per: '2024', src: 'news', note: 'Profit from interest on the US Treasury bills and other reserves backing its stablecoin.' },
  bcg: { r: 13.5, per: '2024', src: 'news' },
  mckinsey: { r: 16, per: '2024', src: 'est', note: 'Private partnership; outside estimate.' },
  bcci: { inr: { r: 9741 }, fx: FY24, per: 'FY2023-24', src: 'news', note: 'Income of about ₹9,741 crore, most of it from the IPL.' },
  rcb: { v: 1.78, per: 'Mar 2026', src: 'news', note: 'Price paid for 100% in the 2026 sale (₹16,660 crore).' },
  haldiram: { v: 10, per: 'Mar 2025', src: 'news', note: 'Valuation of the snacks business implied by the Temasek deal.' },
  gpif: { aum: 1700, per: '2025', src: 'est' },
  koreanps: { aum: 870, per: '2025', src: 'est' },
  cpp: { aum: 520, per: '2025', src: 'est', note: 'About C$714B.' },
  calpers: { aum: 550, per: '2025', src: 'est' },
  gates: { a: 77, per: '2024', src: 'est', note: 'Endowment.' },
  wellcome: { a: 47, per: '2024', src: 'est', note: 'Endowment of about £37B.' },
  fed: { a: 6600, per: '2025', src: 'est', note: 'Balance sheet.' },
  epfo: { s: 'Retirement savings of about 7 crore contributing members', src: 'est' }
};
