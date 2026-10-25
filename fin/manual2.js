// Hand-compiled figures for entities added on 21 Oct 2026 (private and state-owned giants the bulk lists miss,
// plus corrections). Same fields and units as manual.js: US$ billions; `inr` in ₹ crore converted at `fx`.
const FY25 = 84.6;
module.exports = {
  // ---------- private giants ----------
  cargill: { r: 154, e: 160000, per: 'FY to May 2025', src: 'news', note: 'Revenue fell for a third year as crop prices dropped.' },
  koch: { r: 125, per: '2024', src: 'est', note: 'Private; outside (Forbes) estimate.' },
  mars: { r: 50, e: 150000, per: '2024', src: 'est', note: 'Private; outside estimate before the Kellanova purchase, which adds roughly $13B of sales.' },
  bosch: { r: 102.8, per: '2025', src: 'news', note: '€91B of sales in 2025 with an operating (EBIT) margin of about 2%.' },
  ikea: { r: 52.3, c: [915e6, 'store visits a year'], per: 'FY to Aug 2025', src: 'news', note: 'Retail sales of all IKEA stores, €44.6B (Inter IKEA); Ingka runs about 87% of them.' },
  aldi: { r: 121, per: '2023', src: 'est', note: 'Combined sales of Aldi Nord and Aldi Süd, about €112B.' },
  schwarz: { r: 209.7, e: 604000, per: '2025', src: 'filing', note: '€185.6B: Lidl €140.2B and Kaufland €36.7B, from about 14,500 stores.' },
  vitol: { r: 343, per: '2024', src: 'news', note: 'Net profit was about $4.5B in 2025, according to people familiar with the figures; Vitol does not publish full accounts.' },
  trafigura: { r: 243, per: 'FY to Sep 2024', src: 'est' },
  cmacgm: { r: 55.5, per: '2024', src: 'est' },
  chanel: { r: 18.7, per: '2024', src: 'news' },
  deloitte: { r: 70.5, e: 470000, per: 'FY to May 2025', src: 'filing', note: 'Global network revenue; member firms are separately owned partnerships.' },
  pwc: { r: 56.9, e: 364000, per: 'FY to Jun 2025', src: 'filing', note: 'Global network revenue.' },
  ey: { r: 53.2, e: 400000, per: 'FY to Jun 2025', src: 'filing', note: 'Global network revenue.' },
  kpmg: { r: 39.8, e: 276000, per: 'FY to Sep 2025', src: 'filing', note: 'Global network revenue.' },
  dangote: { s: 'Refinery capacity 650,000 barrels a day (opened 2024)', src: 'news' },
  zoho: { s: 'More than 100 million users (company figure)', src: 'est' },
  vanguard: { aum: 10000, per: '2025', src: 'est', note: 'Over $10 trillion under management (company figure).' },
  fidelity: { aum: 6000, per: '2025', src: 'est' },
  stripe: { v: 159, s: 'Payments processed: $1.9 trillion in 2025', per: 'Feb 2026', src: 'news', note: 'Valuation set in an employee and investor share sale.' },
  databricks: { v: 190, s: 'Revenue run-rate above $7B (2026)', per: 'Aug 2026', src: 'news' },
  shein: { m: 27, per: 'Sep 2026', src: 'news', note: 'Market value at the 1 September 2026 Hong Kong listing; revenue is the trailing 12 months.' },
  // ---------- state companies ----------
  syngenta: { r: 28.8, per: '2024', src: 'est' },
  pertamina: { r: 75.3, per: '2024', src: 'est' },
  emirates: { r: 39.6, n: 6.2, per: 'FY2024-25', src: 'est', note: 'Emirates Group (airline and dnata): AED 145.4B revenue and a record AED 22.7B profit.' },
  baowu: { s: 'About 130 million tonnes of crude steel a year', src: 'est' },
  qatarenergy: { s: 'LNG capacity 77 million tonnes a year, expanding to about 142 million by 2030', src: 'est' },
  danantara: { aum: 900, per: '2025', src: 'est', note: 'Assets of the state companies it holds, as announced at its launch.' },
  indianrailways: { inr: { r: 265000 }, fx: FY25, e: 1200000, s: 'About 7 billion passenger journeys a year', per: 'FY2024-25', src: 'est', note: 'Gross traffic receipts, roughly ₹2.65 lakh crore.' },
  nse: { inr: { r: 19177, n: 12188 }, fx: FY25, v: 50, per: 'FY2024-25', src: 'est', note: 'Valuation implied by unlisted-share prices in 2026; NSE has not yet listed.' },
  rrbs: { s: '28 banks with about 22,000 branches', src: 'est' },
  // ---------- corrections to bulk figures ----------
  pfc: { drop: ['p'], note: 'Pre-tax profit omitted: the bulk listing figure is larger than its revenue.' },
  rec: { drop: ['p'], note: 'Pre-tax profit omitted: the bulk listing counts revenue net of interest costs, which makes the margin look like 100%.' },
  // ---------- customer bases ----------
  costco: { c: [81e6, 'paid household members'], per: 'Aug 2025', src: 'est' },
  // ---------- reported inside a parent ----------
  aetna: { w: 'cvs' },
  hsbcindia: { w: 'hsbc' },
  scbindia: { w: 'standardchartered' },
  kotaklife: { w: 'kotak' }
};
