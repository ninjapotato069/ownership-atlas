#!/usr/bin/env bash
# Builds the Ownership Atlas APK without Gradle: aapt + javac + dex + zipalign + apksigner.
# Uses the Android SDK when ANDROID_HOME is set (GitHub runners: newest platform and build tools),
# otherwise Debian/Ubuntu packages (aapt apksigner zipalign dalvik-exchange android-sdk-platform-23).
# Signing: keys/atlas.p12 + keys/pass.txt, or ATLAS_KEYSTORE_B64 + ATLAS_KEYSTORE_PASS (GitHub secrets).
# The same key must sign every build, or phones refuse the update.
set -euo pipefail
cd "$(dirname "$0")"
PKG=com/ownershipatlas/app
VERSION=$(grep -o 'versionName="[^"]*"' AndroidManifest.xml | cut -d'"' -f2)
OUT=dist/OwnershipAtlas-$VERSION.apk

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -n "$SDK" ] && [ -d "$SDK/build-tools" ]; then
  BT="$SDK/build-tools/$(ls "$SDK/build-tools" | sort -V | tail -1)"
  AJAR="$SDK/platforms/$(ls "$SDK/platforms" | grep -E '^android-[0-9]+$' | sort -V | tail -1)/android.jar"
  AAPT="$BT/aapt"; ZIPALIGN="$BT/zipalign"; APKSIGNER="$BT/apksigner"
  dex() { "$BT/d8" --min-api 24 --lib "$AJAR" --output build/dex $(find build/obj -name '*.class'); }
else
  AJAR=/usr/lib/android-sdk/platforms/android-23/android.jar
  AAPT=aapt; ZIPALIGN=zipalign; APKSIGNER=apksigner
  dex() { dalvik-exchange --dex --min-sdk-version=24 --output=build/dex/classes.dex build/obj; }
fi
echo "platform: $AJAR"

node make-assets.js
rm -rf build && mkdir -p build/gen build/obj build/dex dist

"$AAPT" package -f -m -J build/gen -M AndroidManifest.xml -S res -I "$AJAR"
javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$AJAR" -classpath "$AJAR" \
  -d build/obj src/$PKG/MainActivity.java build/gen/$PKG/R.java
dex
"$AAPT" package -f -M AndroidManifest.xml -S res -A assets -I "$AJAR" -F build/unsigned.apk
(cd build/dex && "$AAPT" add ../unsigned.apk classes.dex >/dev/null)
"$ZIPALIGN" -f -p 4 build/unsigned.apk build/aligned.apk

mkdir -p keys
if [ -n "${ATLAS_KEYSTORE_B64:-}" ]; then
  printf '%s' "$ATLAS_KEYSTORE_B64" | base64 -d > keys/atlas.p12
  printf '%s' "$ATLAS_KEYSTORE_PASS" > keys/pass.txt
fi
if [ ! -f keys/atlas.p12 ]; then
  if [ -n "${CI:-}" ]; then echo "Signing key missing: set the ATLAS_KEYSTORE_B64 and ATLAS_KEYSTORE_PASS secrets." >&2; exit 1; fi
  head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24 > keys/pass.txt
  keytool -genkeypair -keystore keys/atlas.p12 -storetype PKCS12 -alias atlas -keyalg RSA -keysize 3072 \
    -validity 10000 -dname "CN=Ownership Atlas" -storepass:file keys/pass.txt -keypass:file keys/pass.txt
fi
"$APKSIGNER" sign --ks keys/atlas.p12 --ks-key-alias atlas --ks-pass file:keys/pass.txt --out "$OUT" build/aligned.apk
"$APKSIGNER" verify --verbose "$OUT" | grep -E 'Verifies|scheme'
ls -la "$OUT"
