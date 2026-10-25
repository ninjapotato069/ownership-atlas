package com.ownershipatlas.app;

import android.app.Activity;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ComponentName;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.Charset;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * One-screen wrapper around the Global Ownership Atlas page.
 *
 * The page, d3 and the fonts ship inside the APK (assets/) and are served from a private
 * https origin, so the app works fully offline and nothing is fetched from the network.
 * Links to sources open in the phone's browser. The page reports its theme colour through a tiny bridge
 * (AtlasApp.setBars) so the status and navigation bars match whichever theme is chosen, and hands over
 * CSV and PNG exports (AtlasApp.saveFile), which open in the share sheet so they can be saved or sent.
 *
 * The one network job: the atlas rebuilds itself every weekday on GitHub (public repository
 * ninjapotato069/ownership-atlas, published with GitHub Pages). The app downloads the new data.json when it
 * opens and about once a day in the background, keeps it in its private storage and serves it to the page as
 * live/data.json; the page uses it when it is newer than the copy built into the app. The app also reads
 * version.json to say when a newer app is out. The page itself never talks to the network.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/index.html";
    private static final int BG_LIGHT = 0xFFEDF1EF;
    private static final int BG_DARK = 0xFF0A1011;
    private static final int BLACK = 0xFF000000;
    // View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR (API 23) and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR (API 26).
    private static final int LIGHT_STATUS = 0x00002000;
    private static final int LIGHT_NAV = 0x00000010;

    // Where the daily atlas is published (GitHub Pages first, the gh-pages branch itself as a fallback).
    static final String SITE = "https://ninjapotato069.github.io/ownership-atlas/";
    static final String RAW = "https://raw.githubusercontent.com/ninjapotato069/ownership-atlas/gh-pages/";
    static final int SCHEMA = 2;
    private static final String PREFS = "atlas-live";
    private static final int JOB_ID = 4201;
    private static final long HOUR = 3600000L;
    private static final Object SYNC_LOCK = new Object();
    private static final AtomicBoolean SYNCING = new AtomicBoolean(false);

    private WebView web;
    private boolean dark;
    private int barColor;
    private boolean lightBg;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        dark = isNight(getResources().getConfiguration());
        barColor = dark ? BG_DARK : BG_LIGHT;
        lightBg = !dark;
        applyBars();

        web = new WebView(this);
        web.setBackgroundColor(dark ? BG_DARK : BG_LIGHT);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        web.setWebViewClient(new AtlasClient());
        web.addJavascriptInterface(new Bridge(), "AtlasApp");
        setContentView(web);
        web.loadUrl(START + "?app=android&theme=" + (dark ? "dark" : "light"));
        scheduleDaily(this);
        syncIfOlder(HOUR);
    }

    /** Dark mode switched while the app is open: tell the page, keeping its state. If the page follows the
     *  device ("Auto" theme) it recolours itself and reports the new bar colour back through the bridge. */
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        boolean night = isNight(newConfig);
        if (night == dark) return;
        dark = night;
        if (web != null) {
            web.evaluateJavascript("window.__atlasTheme&&window.__atlasTheme('" + (dark ? "dark" : "light") + "')", null);
        }
    }

    /** Back closes a story, a traced path or a company profile first; otherwise it leaves the app. */
    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("(window.atlasBack&&window.atlasBack())?1:0", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String handled) {
                if (!"1".equals(handled) && !isFinishing()) MainActivity.super.onBackPressed();
            }
        });
    }

    @Override
    protected void onPause() {
        if (web != null) {
            web.onPause();
            web.pauseTimers();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.resumeTimers();
            web.onResume();
        }
        syncIfOlder(6 * HOUR);
    }

    // ---------- the daily atlas ----------

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static File liveFile(Context c) {
        return new File(new File(c.getFilesDir(), "live"), "data.json");
    }

    static int appCode(Context c) {
        try {
            return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionCode;
        } catch (Exception e) {
            return 0;
        }
    }

    /** Status for the page: downloaded data, last check, last error, and the newest app release. */
    static String info(Context c, boolean manual) {
        SharedPreferences p = prefs(c);
        JSONObject o = new JSONObject();
        try {
            o.put("hasData", liveFile(c).isFile());
            o.put("dataBuiltAt", p.getString("builtAt", ""));
            o.put("lastOk", p.getLong("lastOk", 0));
            o.put("lastTry", p.getLong("lastTry", 0));
            o.put("error", p.getString("error", ""));
            o.put("appCode", appCode(c));
            o.put("latestCode", p.getInt("latestCode", 0));
            o.put("latestName", p.getString("latestName", ""));
            o.put("apk", p.getString("apk", ""));
            o.put("site", SITE);
            o.put("manual", manual);
        } catch (JSONException ignored) {
            // Only plain values are put.
        }
        return o.toString();
    }

    private static HttpURLConnection open(String url, String etag) throws IOException {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(15000);
        con.setReadTimeout(60000);
        con.setRequestProperty("Accept", "application/json");
        con.setRequestProperty("User-Agent", "OwnershipAtlas-Android");
        if (etag != null) con.setRequestProperty("If-None-Match", etag);
        return con;
    }

    /**
     * Downloads data.json if it changed since the last download (the server answers 304 when it has not), and
     * version.json. The new data replaces the old only after it parses as an atlas this app can show.
     */
    static String sync(Context c, boolean manual) {
        synchronized (SYNC_LOCK) {
            SharedPreferences p = prefs(c);
            long now = System.currentTimeMillis();
            String error = "";
            File f = liveFile(c);
            String etag = f.isFile() ? p.getString("etag", null) : null;
            int code = -1;
            for (String base : new String[]{SITE, RAW}) {
                HttpURLConnection con = null;
                try {
                    con = open(base + "data.json", etag);
                    code = con.getResponseCode();
                    if (code == HttpURLConnection.HTTP_NOT_MODIFIED) {
                        p.edit().putLong("lastOk", now).apply();
                        error = "";
                        break;
                    } else if (code == HttpURLConnection.HTTP_OK) {
                        byte[] body = readAll(con.getInputStream(), 40 * 1024 * 1024);
                        String builtAt = check(body);
                        File dir = f.getParentFile();
                        if (dir == null || (!dir.isDirectory() && !dir.mkdirs())) throw new IOException("no folder");
                        File tmp = new File(dir, "data.json.part");
                        FileOutputStream out = new FileOutputStream(tmp);
                        try {
                            out.write(body);
                        } finally {
                            out.close();
                        }
                        if (!tmp.renameTo(f)) throw new IOException("rename failed");
                        p.edit().putString("etag", con.getHeaderField("ETag")).putString("builtAt", builtAt).putLong("lastOk", now).apply();
                        error = "";
                        break;
                    } else {
                        error = "The atlas site answered " + code + ". The app will try again later.";
                    }
                } catch (JSONException e) {
                    error = "The downloaded atlas was not valid, so the previous one is kept.";
                    break;
                } catch (IOException e) {
                    error = "Could not reach GitHub. The app will try again later.";
                } finally {
                    if (con != null) con.disconnect();
                }
            }
            // Newest app release (small file; failures here are not reported).
            HttpURLConnection con = null;
            try {
                con = open(SITE + "version.json", null);
                if (con.getResponseCode() == HttpURLConnection.HTTP_OK) {
                    JSONObject v = new JSONObject(new String(readAll(con.getInputStream(), 65536), Charset.forName("UTF-8")));
                    String apk = v.optString("apk", "");
                    if (apk.startsWith("https://github.com/")) {
                        p.edit().putInt("latestCode", v.optInt("versionCode", 0)).putString("latestName", v.optString("versionName", ""))
                                .putString("apk", apk).apply();
                    }
                }
            } catch (Exception ignored) {
                // Try again next time.
            } finally {
                if (con != null) con.disconnect();
            }
            p.edit().putLong("lastTry", now).putString("error", error).apply();
            return info(c, manual);
        }
    }

    private static byte[] readAll(InputStream in, int max) throws IOException {
        try {
            ByteArrayOutputStream buf = new ByteArrayOutputStream(1 << 20);
            byte[] chunk = new byte[1 << 16];
            int n;
            while ((n = in.read(chunk)) > 0) {
                buf.write(chunk, 0, n);
                if (buf.size() > max) throw new IOException("too large");
            }
            return buf.toByteArray();
        } finally {
            in.close();
        }
    }

    /** Returns the data's build time, or throws if it is not an atlas this version of the app can show. */
    private static String check(byte[] body) throws JSONException {
        JSONObject j = new JSONObject(new String(body, Charset.forName("UTF-8")));
        if (j.optInt("schema") != SCHEMA || j.optJSONArray("nodes") == null || j.getJSONArray("nodes").length() < 1000
                || j.optString("builtAt", "").length() == 0) throw new JSONException("not an atlas");
        return j.getString("builtAt");
    }

    /** About once a day, whenever there is a network, even if the app is closed (survives restarts). */
    static void scheduleDaily(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        List<JobInfo> pending = js.getAllPendingJobs();
        if (pending != null) for (JobInfo j : pending) if (j.getId() == JOB_ID) return;
        JobInfo job = new JobInfo.Builder(JOB_ID, new ComponentName(c, SyncJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(24 * HOUR)
                .setPersisted(true)
                .build();
        try {
            js.schedule(job);
        } catch (RuntimeException ignored) {
            // The app still checks whenever it is opened.
        }
    }

    private void syncIfOlder(long age) {
        if (System.currentTimeMillis() - prefs(this).getLong("lastTry", 0) > age) startSync(false);
    }

    /** Runs a download off the main thread, then tells the page (window.atlasLive) what happened. */
    private void startSync(final boolean manual) {
        if (!SYNCING.compareAndSet(false, true)) return;
        final Context app = getApplicationContext();
        new Thread(new Runnable() {
            @Override
            public void run() {
                final String status;
                try {
                    status = sync(app, manual);
                } finally {
                    SYNCING.set(false);
                }
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (web != null && !isFinishing()) {
                            web.evaluateJavascript("window.atlasLive&&window.atlasLive(" + JSONObject.quote(status) + ")", null);
                        }
                    }
                });
            }
        }, "atlas-sync").start();
    }

    /** The background half of the daily refresh. */
    public static class SyncJob extends JobService {
        @Override
        public boolean onStartJob(final JobParameters params) {
            final Context app = getApplicationContext();
            new Thread(new Runnable() {
                @Override
                public void run() {
                    if (SYNCING.compareAndSet(false, true)) {
                        try {
                            sync(app, false);
                        } finally {
                            SYNCING.set(false);
                        }
                    }
                    jobFinished(params, false);
                }
            }, "atlas-sync-job").start();
            return true;
        }

        @Override
        public boolean onStopJob(JobParameters params) {
            return true;
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            ViewGroup parent = (ViewGroup) web.getParent();
            if (parent != null) parent.removeView(web);
            web.stopLoading();
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    private static boolean isNight(Configuration c) {
        return (c.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    }

    /** Status and navigation bars take the page's background colour, with dark icons on light themes. */
    private void applyBars() {
        int bg = barColor;
        boolean lightNavIcons = Build.VERSION.SDK_INT >= 26;
        Window w = getWindow();
        w.setBackgroundDrawable(new ColorDrawable(bg));
        w.setStatusBarColor(bg);
        w.setNavigationBarColor(!lightBg || lightNavIcons ? bg : BLACK);
        View decor = w.getDecorView();
        int flags = decor.getSystemUiVisibility() & ~(LIGHT_STATUS | LIGHT_NAV);
        if (lightBg) flags |= LIGHT_STATUS | (lightNavIcons ? LIGHT_NAV : 0);
        decor.setSystemUiVisibility(flags);
    }

    /** Called by the page (window.AtlasApp.setBars) whenever its theme changes. Accepts only "#rrggbb". */
    private final class Bridge {
        @JavascriptInterface
        public void setBars(final String hex, final boolean light) {
            if (hex == null || !hex.matches("#[0-9a-fA-F]{6}")) return;
            final int color = Color.parseColor(hex);
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (isFinishing()) return;
                    barColor = color;
                    lightBg = light;
                    applyBars();
                    if (web != null) web.setBackgroundColor(color);
                }
            });
        }

        /** Status of the daily atlas download (see MainActivity.info). */
        @JavascriptInterface
        public String liveInfo() {
            return info(MainActivity.this, false);
        }

        /** Checks GitHub now; the result arrives through window.atlasLive. */
        @JavascriptInterface
        public void syncNow() {
            startSync(true);
        }

        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            if (name == null || base64 == null) return;
            final String safe = name.replaceAll("[^A-Za-z0-9._-]", "_");
            if (safe.length() == 0 || safe.length() > 120 || safe.startsWith(".")) return;
            final String type = mime != null && mime.matches("[a-z]+/[a-z0-9.+-]+") ? mime : "application/octet-stream";
            try {
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                if (data.length == 0 || data.length > 40 * 1024 * 1024) return;
                File dir = new File(getCacheDir(), "exports");
                if (!dir.isDirectory() && !dir.mkdirs()) return;
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) if (System.currentTimeMillis() - f.lastModified() > 3600000L) f.delete();
                FileOutputStream out = new FileOutputStream(new File(dir, safe));
                try { out.write(data); } finally { out.close(); }
            } catch (Exception e) {
                return;
            }
            final Uri uri = Uri.parse("content://" + Files.AUTHORITY + "/" + Uri.encode(safe));
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (isFinishing()) return;
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType(type);
                    send.putExtra(Intent.EXTRA_STREAM, uri);
                    send.setClipData(ClipData.newRawUri(safe, uri));
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    try {
                        startActivity(Intent.createChooser(send, "Save or share " + safe));
                    } catch (ActivityNotFoundException ignored) {
                        // Nothing can receive the file.
                    }
                }
            });
        }
    }

    /** Read-only access to the exports folder for the app that receives a shared file. */
    public static class Files extends ContentProvider {
        static final String AUTHORITY = "com.ownershipatlas.app.files";

        @Override
        public boolean onCreate() {
            return true;
        }

        private File file(Uri uri) throws FileNotFoundException {
            String n = uri.getLastPathSegment();
            if (n == null || n.contains("/") || n.contains("..")) throw new FileNotFoundException();
            File f = new File(new File(getContext().getCacheDir(), "exports"), n);
            if (!f.isFile()) throw new FileNotFoundException();
            return f;
        }

        @Override
        public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
            if (mode != null && mode.indexOf('w') >= 0) throw new FileNotFoundException("read-only");
            return ParcelFileDescriptor.open(file(uri), ParcelFileDescriptor.MODE_READ_ONLY);
        }

        @Override
        public String getType(Uri uri) {
            String n = uri.getLastPathSegment();
            if (n == null) return null;
            if (n.endsWith(".png")) return "image/png";
            if (n.endsWith(".csv")) return "text/csv";
            return "application/octet-stream";
        }

        @Override
        public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
            File f;
            try {
                f = file(uri);
            } catch (FileNotFoundException e) {
                return null;
            }
            String[] cols = projection != null ? projection : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
            MatrixCursor c = new MatrixCursor(cols);
            Object[] row = new Object[cols.length];
            for (int i = 0; i < cols.length; i++) {
                if (OpenableColumns.DISPLAY_NAME.equals(cols[i])) row[i] = f.getName();
                else if (OpenableColumns.SIZE.equals(cols[i])) row[i] = f.length();
            }
            c.addRow(row);
            return c;
        }

        @Override
        public Uri insert(Uri uri, ContentValues values) {
            return null;
        }

        @Override
        public int delete(Uri uri, String selection, String[] args) {
            return 0;
        }

        @Override
        public int update(Uri uri, ContentValues values, String selection, String[] args) {
            return 0;
        }
    }

    private final class AtlasClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            Uri u = Uri.parse(url);
            if (HOST.equals(u.getHost())) return false;
            String scheme = u.getScheme();
            if ("http".equals(scheme) || "https".equals(scheme) || "mailto".equals(scheme)) {
                try {
                    Intent i = new Intent(Intent.ACTION_VIEW, u);
                    i.addCategory(Intent.CATEGORY_BROWSABLE);
                    startActivity(i);
                } catch (ActivityNotFoundException ignored) {
                    // No browser installed: stay on the page.
                }
            }
            return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return serve(request.getUrl());
        }
    }

    /** Serves files from assets/ for the private origin and refuses every other host. */
    private WebResourceResponse serve(Uri u) {
        String scheme = u.getScheme();
        if (!"https".equals(scheme) && !"http".equals(scheme)) return null;
        if (!HOST.equals(u.getHost())) return empty(403, "Forbidden");
        String path = u.getPath();
        if (path == null || path.length() <= 1) path = "/index.html";
        String name = path.substring(1);
        if (name.contains("..")) return empty(404, "Not Found");
        if ("live/data.json".equals(name)) {
            File f = liveFile(this);
            if (!f.isFile()) return empty(404, "Not Found");
            try {
                Map<String, String> headers = new HashMap<String, String>();
                headers.put("Cache-Control", "no-store");
                return new WebResourceResponse("application/json", "utf-8", 200, "OK", headers, new FileInputStream(f));
            } catch (IOException e) {
                return empty(404, "Not Found");
            }
        }
        try {
            InputStream in = getAssets().open(name);
            Map<String, String> headers = new HashMap<String, String>();
            headers.put("Cache-Control", "no-cache");
            headers.put("Access-Control-Allow-Origin", "*");
            String type = mime(name);
            String charset = type.startsWith("text/") ? "utf-8" : null;
            return new WebResourceResponse(type, charset, 200, "OK", headers, in);
        } catch (IOException e) {
            return empty(404, "Not Found");
        }
    }

    private static WebResourceResponse empty(int code, String reason) {
        return new WebResourceResponse("text/plain", "utf-8", code, reason,
                new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }

    private static String mime(String name) {
        String n = name.toLowerCase(Locale.ROOT);
        if (n.endsWith(".html")) return "text/html";
        if (n.endsWith(".js")) return "text/javascript";
        if (n.endsWith(".css")) return "text/css";
        if (n.endsWith(".woff2")) return "font/woff2";
        if (n.endsWith(".svg")) return "image/svg+xml";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }
}
