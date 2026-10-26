# Global Ownership Atlas

Who owns and who controls the world's companies, from 1900 to today: governments, families, funds and companies linked by their stakes, takeovers, bailouts and mergers. One page works as a website and inside the Android app.

- **Web app:** https://ninjapotato069.github.io/ownership-atlas/
- **Android app:** the newest APK is on the [Releases](https://github.com/ninjapotato069/ownership-atlas/releases) page. Download it on the phone and open it. Installing over an older version keeps your settings.

## How it stays up to date

`.github/workflows/refresh.yml` runs every weekday at 22:37 UTC (04:07 IST), after the US close:

1. **`pipeline/markets.py`** reads TradingView's stock screener market by market. It keeps one line per company and records every listed company worth US$1.5 billion or more that the atlas holds.
   - A company joins the atlas when it reaches $3 billion.
   - It leaves after 30 days below $1.5 billion, or 14 days missing from the screener.
2. **`pipeline/wikidata.py`** matches those companies to Wikidata by ISIN, then by exchange and ticker, then by a checked name search. From Wikidata it takes:
   - founding years, descriptions and websites;
   - owners: parent organisations, and holders with a stated stake of 10% or more or a state, followed two levels up.

   The full refresh runs weekly; on other days only new companies are looked up.
3. **`build/build.js`** merges the hand-built atlas with this automatic layer and writes the page and `data.json`. Hand-built entities and links always win.
4. The result is published to the `gh-pages` branch, which GitHub Pages serves. That branch keeps a single commit.

The Android app downloads `data.json` when it opens and about once a day in the background. `.github/workflows/app.yml` builds the APK whenever `app/` changes. When `versionName` in `app/AndroidManifest.xml` is new, it publishes a release and the app shows an update note.

A push to `main` rebuilds and republishes the site straight away. The *Refresh the atlas* workflow can also be started by hand from the Actions tab.

## Layout

| Path | What it holds |
|---|---|
| `data/` | The hand-built atlas: entities (`nodesN.js`), links (`linksN.js`), stories, countries, cities, headquarters |
| `fin/` | Financial figures for the hand-built entities |
| `template.html` | The page: charts, network, maps and the Markets tab |
| `build/` | `build.js` (validate and inline everything) and `engine.js` (who controls whom) |
| `pipeline/` | Daily market list, Wikidata lookups, industry mapping, extra site files |
| `config/atlas_map.json` | Which stock listing is which hand-built entity |
| `app/` | Android wrapper (WebView, daily download, exports to the share sheet), built without Gradle |
| `geo/` | Map shapes (Natural Earth) |

## Build locally

```bash
npm ci --prefix build && npm ci --prefix app/vendor
node build/build.js          # dist/atlas.html and dist/data.json; copies of live/*.json from gh-pages add the automatic layer
bash app/build.sh            # needs the Android SDK (ANDROID_HOME) or Debian's aapt/apksigner/zipalign/dalvik-exchange
```

The APK is signed with the key in the repository secrets `ATLAS_KEYSTORE_B64` (the base64 of the PKCS#12 keystore) and `ATLAS_KEYSTORE_PASS`. Without them the app workflow skips the build. Keep using the same key, or phones refuse the update.

## Sources

- The hand-built atlas cites its sources in the page (Method & sources tab).
- Market values come from TradingView's public stock screener: prices are delayed, values are converted to US dollars, and the figures are for personal, non-commercial use.
- Wikidata content is CC0. Volunteers maintain it, so links taken from it are labelled "Wikidata" in the atlas.
