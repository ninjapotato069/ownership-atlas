// The Android app's offline files (app/assets/): the page (make-page.js), the data built into the app
// (data.json, with its build time in data-built.txt), d3 and the three typefaces. Nothing comes from the network.
const fs = require('fs');
const path = require('path');
const {FACES, appPage} = require('./make-page');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'assets');
const FROM = {
  archivo: path.join(__dirname, 'vendor', 'node_modules', '@fontsource-variable', 'archivo', 'files'),
  newsreader: path.join(__dirname, 'vendor', 'node_modules', '@fontsource-variable', 'newsreader', 'files'),
  mono: path.join(__dirname, 'vendor', 'node_modules', '@fontsource', 'ibm-plex-mono', 'files'),
};
const must = (cond, msg) => { if (!cond) { console.error('make-assets: ' + msg); process.exit(1); } };

const shell = fs.readFileSync(path.join(ROOT, 'dist', 'shell.html'), 'utf8');
must(shell.includes('const DATA = null;'), 'dist/shell.html is not the data-less page (run node build/build.js)');
const data = fs.readFileSync(path.join(ROOT, 'dist', 'data.json'), 'utf8');
const builtAt = JSON.parse(data).builtAt;
must(typeof builtAt === 'string' && builtAt.length > 0, 'dist/data.json has no builtAt');

fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(path.join(OUT, 'fonts'), {recursive: true});
for (const [, file, , , , from] of FACES) fs.copyFileSync(path.join(FROM[from], file), path.join(OUT, 'fonts', file));
fs.copyFileSync(path.join(ROOT, 'build', 'node_modules', 'd3', 'dist', 'd3.min.js'), path.join(OUT, 'd3.min.js'));
const page = appPage(shell);
fs.writeFileSync(path.join(OUT, 'index.html'), page);
// the app downloads a page only when the published one differs from this one
fs.writeFileSync(path.join(OUT, 'page-sha.txt'), require('crypto').createHash('sha256').update(page).digest('hex'));
fs.writeFileSync(path.join(OUT, 'data.json'), data);
fs.writeFileSync(path.join(OUT, 'data-built.txt'), builtAt);
const kb = f => Math.round(fs.statSync(path.join(OUT, f)).size / 1024);
console.log('assets: index.html', kb('index.html') + 'KB, data.json', kb('data.json') + 'KB (built ' + builtAt + '), d3.min.js', kb('d3.min.js') + 'KB, fonts', FACES.length);
