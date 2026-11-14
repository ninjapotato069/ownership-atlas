# Global Ownership Atlas

Who owns and who controls the world's companies, from 1900 to today: governments, families, funds and companies linked by their stakes, takeovers, bailouts and mergers. One page works as a website and inside the Android app.

- **Web app:** https://ninjapotato069.github.io/ownership-atlas/
- **Android app:** the newest APK is at https://ninjapotato069.github.io/ownership-atlas/app/ (file named in [`app/releases/latest.json`](app/releases/latest.json)). Download it on the phone and open it. Installing over an older version keeps your settings. From 1.8 on, the app updates its own pages, so new features arrive without a reinstall. From 1.9 on, it also downloads a newer app by itself and offers a one-tap **Install** (Android asks once to allow installs from the app, then to confirm).
- **On a phone:** a bottom bar (Atlas, News, Markets, Search, More), a side tab on the right edge (Details of the selected company, Today's status and biggest moves, Menu), lists drawn by the page instead of system drop-downs, suggestions under every search field, and notices that stack above the bar and stay until answered when they need an answer. One finger scrolls the page over the network; pinch (or full screen) to move inside it.

## How it stays up to date

`.github/workflows/refresh.yml` runs every weekday at 22:37 UTC (04:07 IST), after the US close:

1. **`pipeline/markets.py`** reads TradingView's stock screener market by market. It keeps one line per company and records every listed company worth US$1.5 billion or more that the atlas holds.
   - A company joins the atlas when it reaches $3 billion.
   - It leaves after 30 days below $1.5 billion, or 14 days missing from the screener.
2. **`pipeline/wikidata.py`** matches those companies to Wikidata by ISIN, then by exchange and ticker, then by a checked name search. From Wikidata it takes:
   - founding years, descriptions and websites;
   - owners: parent organisations, and holders with a stated stake of 10% or more or a state, followed two levels up.

   The full refresh runs weekly; on other days only new companies are looked up.
3. **`pipeline/news.py`** collects the day's news into `live/news.json`, keeping 7 days:
   - the biggest moves in market value (in dollars, both ways), with headlines about each company;
   - deal headlines (acquisitions, mergers, stakes, buyouts); the build keeps those that name an entity in the atlas;
   - market headlines.

   Headlines come from Google News search feeds (Bing News as a fallback): the headline, source, time and link only.
4. **`build/build.js`** merges the hand-built atlas with this automatic layer and writes the page and `data.json`. Hand-built entities and links always win.
5. The result is published to the `gh-pages` branch, which GitHub Pages serves. That branch keeps a single commit.

The Android app downloads `data.json` when it opens and about once a day in the background. It also checks `app/page.json`: when the page's code changed (and this app can run it), it downloads `app/page.html`, checks its SHA-256 and shows it instead of the page built into the app. A downloaded page that does not start is set aside and the built-in page comes back. `app/make-page.js` builds that page; raise `MIN_CODE` there when a page needs a newer app.

A change to the app itself (Java, manifest) still needs a new APK: build it with `app/build.sh`, put it in `app/releases/` and update `latest.json`; the app then shows an update note. `.github/workflows/app.yml` can do this on GitHub instead when the signing secrets are set.

A push to `main` rebuilds and republishes the site straight away. The *Refresh the atlas* workflow can also be started by hand from the Actions tab.

## Layout

| Path | What it holds |
|---|---|
| `data/` | The hand-built atlas: entities (`nodesN.js`), links (`linksN.js`), stories, countries, cities, headquarters |
| `fin/` | Financial figures for the hand-built entities |
| `template.html` | The page: charts, network, maps and the Markets tab |
| `build/` | `build.js` (validate and inline everything) and `engine.js` (who controls whom) |
| `pipeline/` | Daily market list, Wikidata lookups, news, industry mapping, extra site files |
| `config/atlas_map.json` | Which stock listing is which hand-built entity |
| `app/` | Android wrapper (WebView, daily download, page updates, exports to the share sheet), built without Gradle; `app/releases/` holds the newest APK |
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
- News: headlines, source names and links from Google News and Bing News search feeds, for personal use; the articles stay with their publishers.
