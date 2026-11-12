// The Android app's page: dist/shell.html (the atlas code without its data) made fully offline. d3 and the
// typefaces are the copies inside the app, and the data is the app's own data.json (the newer of the copy built
// into the app and the one it downloads each day).
//
// make-assets.js puts this page into the APK. The refresh workflow also publishes it as app/page.html, with
// app/page.json (its SHA-256 and the oldest app version that can run it), and the app swaps it in by itself:
// new features and fixes reach phones without a reinstall.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const D3 = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js';
// Oldest app (versionCode) that can run this page: 9 = 1.8, the first that serves data.json next to the page.
// Raise it when the page starts using something only a newer app provides.
const MIN_CODE = 9;
// Latin + Latin Extended cover every character in the data (₹ and € sit in Latin Extended).
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
// The typefaces inside the app: family, file (app/assets/fonts), weight, extra CSS, characters.
const FACES = [
  ['Archivo', 'archivo-latin-ext-wdth-normal.woff2', '100 900', 'font-stretch:62% 125%;', LATIN_EXT, 'archivo'],
  ['Archivo', 'archivo-latin-wdth-normal.woff2', '100 900', 'font-stretch:62% 125%;', LATIN, 'archivo'],
  // Newsreader: headlines in the Paper and Vintage themes
  ['Newsreader', 'newsreader-latin-ext-wght-normal.woff2', '200 800', '', LATIN_EXT, 'newsreader'],
  ['Newsreader', 'newsreader-latin-wght-normal.woff2', '200 800', '', LATIN, 'newsreader'],
  ...[400, 500, 600].flatMap(w => [
    ['IBM Plex Mono', `ibm-plex-mono-latin-ext-${w}-normal.woff2`, String(w), '', LATIN_EXT, 'mono'],
    ['IBM Plex Mono', `ibm-plex-mono-latin-${w}-normal.woff2`, String(w), '', LATIN, 'mono'],
  ]),
];

function appPage(src) {
  const must = (cond, msg) => { if (!cond) throw new Error('make-page: ' + msg); };
  must(src.includes(D3), 'd3 script tag not found');
  src = src.replace(D3, 'd3.min.js')
    .replace(/<meta name="claude:viewport-fit-sides"[^>]*>\s*/, '')
    .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
    .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/, '');
  must(!/https:\/\/(fonts|cdnjs)\./.test(src.replace(/href="https:[^"]*"/g, '')), 'external resource still referenced');
  const faces = FACES.map(([family, file, weight, extra, range]) =>
    `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${weight};${extra}src:url(fonts/${file}) format('woff2');unicode-range:${range}}`);
  // The device's dark-mode setting comes from Android (?theme=dark|light) and live via __atlasTheme(); a theme the
  // person picks in the page is stored in localStorage and takes precedence (the page redefines __atlasTheme).
  const boot = `(function(){var r=document.documentElement,q=location.search,m=/[?&]theme=(dark|light)/.exec(q);if(m)r.setAttribute('data-theme',m[1]);if(/[?&]app=android/.test(q))r.classList.add('in-app');window.__atlasTheme=function(t){r.setAttribute('data-theme',t)};})();`;
  const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<script>${boot}</script>
<style>${faces.join('\n')}
[hidden]{display:none!important}
html{-webkit-tap-highlight-color:transparent;-webkit-text-size-adjust:100%}
@media (max-width:760px){.in-app .mast .lede{display:none}.in-app .mast{padding-bottom:14px}}
</style>
`;
  const cut = src.indexOf('<div class="page">');
  must(cut > 0, 'page start not found');
  return head + src.slice(0, cut) + '</head>\n<body>\n' + src.slice(cut) + '\n</body>\n</html>\n';
}

module.exports = {FACES, MIN_CODE, appPage};

if (require.main === module) {
  const shell = fs.readFileSync(path.join(ROOT, 'dist', 'shell.html'), 'utf8');
  if (!shell.includes('const DATA = null;')) { console.error('make-page: dist/shell.html is not the data-less page'); process.exit(1); }
  const html = appPage(shell);
  const out = path.join(ROOT, 'dist', 'app');
  fs.mkdirSync(out, {recursive: true});
  fs.writeFileSync(path.join(out, 'page.html'), html);
  const sha256 = crypto.createHash('sha256').update(html).digest('hex');
  fs.writeFileSync(path.join(out, 'page.json'), JSON.stringify({v: 1, schema: 2, minCode: MIN_CODE, bytes: Buffer.byteLength(html), sha256}) + '\n');
  console.log('app page:', Math.round(Buffer.byteLength(html) / 1024) + 'KB, sha256', sha256.slice(0, 12));
}
