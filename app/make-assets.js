// Turns dist/atlas.html into a self-contained offline page for the Android app (app/assets/).
// d3 and the three typefaces are copied in; nothing is loaded from the network.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'assets');
const FONTS = path.join(__dirname, 'vendor', 'node_modules', '@fontsource-variable', 'archivo', 'files');
const MONO = path.join(__dirname, 'vendor', 'node_modules', '@fontsource', 'ibm-plex-mono', 'files');
const SERIF = path.join(__dirname, 'vendor', 'node_modules', '@fontsource-variable', 'newsreader', 'files');

let src = fs.readFileSync(path.join(ROOT, 'dist', 'atlas.html'), 'utf8');
const D3 = 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js';
const must = (cond, msg) => { if (!cond) { console.error('make-assets: ' + msg); process.exit(1); } };
must(src.includes(D3), 'd3 script tag not found');
src = src.replace(D3, 'd3.min.js')
  .replace(/<meta name="claude:viewport-fit-sides"[^>]*>\s*/, '')
  .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/, '');
must(!/https:\/\/(fonts|cdnjs)\./.test(src.replace(/href="https:[^"]*"/g, '')), 'external resource still referenced');

// Latin + Latin Extended cover every character in the data (₹ and € sit in Latin Extended).
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
const faces = [];
const copied = [];
function face(family, file, from, weight, extra, range) {
  fs.copyFileSync(path.join(from, file), path.join(OUT, 'fonts', file)); copied.push(file);
  faces.push(`@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${weight};${extra}src:url(fonts/${file}) format('woff2');unicode-range:${range}}`);
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
face('Archivo', 'archivo-latin-ext-wdth-normal.woff2', FONTS, '100 900', 'font-stretch:62% 125%;', LATIN_EXT);
face('Archivo', 'archivo-latin-wdth-normal.woff2', FONTS, '100 900', 'font-stretch:62% 125%;', LATIN);
// Newsreader: headlines in the Paper and Vintage themes
face('Newsreader', 'newsreader-latin-ext-wght-normal.woff2', SERIF, '200 800', '', LATIN_EXT);
face('Newsreader', 'newsreader-latin-wght-normal.woff2', SERIF, '200 800', '', LATIN);
for (const w of [400, 500, 600]) {
  face('IBM Plex Mono', `ibm-plex-mono-latin-ext-${w}-normal.woff2`, MONO, w, '', LATIN_EXT);
  face('IBM Plex Mono', `ibm-plex-mono-latin-${w}-normal.woff2`, MONO, w, '', LATIN);
}
fs.copyFileSync(path.join(ROOT, 'build', 'node_modules', 'd3', 'dist', 'd3.min.js'), path.join(OUT, 'd3.min.js'));

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
const out = head + src.slice(0, cut) + '</head>\n<body>\n' + src.slice(cut) + '\n</body>\n</html>\n';
fs.writeFileSync(path.join(OUT, 'index.html'), out);
const kb = f => Math.round(fs.statSync(path.join(OUT, f)).size / 1024);
console.log('assets: index.html', kb('index.html') + 'KB, d3.min.js', kb('d3.min.js') + 'KB, fonts', copied.length);
