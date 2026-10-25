#!/usr/bin/env bash
# Builds the map geometry from Natural Earth 1:10m data (public domain), India's point of view:
#   geo/world.topo.json  countries of the world, with India's official boundaries
#   geo/india.topo.json  India's states and union territories (Jammu & Kashmir and Ladakh drawn to the
#                        official boundary) plus neighbouring countries for context
# Usage: bash geo/make-geo.sh <work-dir>   (downloads ~54 MB of source data into the work dir)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
MS="$HERE/../build/node_modules/.bin/mapshaper"
W="${1:?work dir}"; mkdir -p "$W"; cd "$W"
NE=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
[ -f ne10_ind.geojson ] || curl -sS -o ne10_ind.geojson "$NE/ne_10m_admin_0_countries_ind.geojson"
[ -f ne10_adm1.geojson ] || curl -sS -o ne10_adm1.geojson "$NE/ne_10m_admin_1_states_provinces.geojson"

# ---- world ----
"$MS" -i ne10_ind.geojson -filter 'ADM0_A3 != "ATA"' \
  -each 'cc = ISO_A2_EH === "-99" ? "" : ISO_A2_EH, name = NAME' -filter-fields cc,name \
  -simplify interval=12000 keep-shapes -filter-islands min-area=40km2 remove-empty \
  -o "$HERE/world.topo.json" format=topojson quantization=40000 force

# ---- India: states, plus the areas India claims that Natural Earth's admin-1 layer leaves out ----
"$MS" -i ne10_adm1.geojson -filter 'adm0_a3 == "IND"' -each 'st = iso_3166_2.replace("IN-", "")' \
  -filter-fields st,name -o states_raw.json format=geojson force
"$MS" -i ne10_adm1.geojson -filter 'iso_3166_2 == "PK-JK"' -filter-fields name -o ajk.json format=geojson force
"$MS" -i ne10_ind.geojson -filter 'ADM0_A3 == "IND"' -filter-fields NAME -o india_pov.json format=geojson force
# claimed areas = official outline minus the states; drop slivers along shared borders
"$MS" -i india_pov.json -erase states_raw.json -explode -each 'km2 = this.area / 1e6' -filter 'km2 > 500' \
  -o claims.json format=geojson force
# Pakistan-administered Kashmir (Muzaffarabad, Mirpur) belongs to the UT of Jammu & Kashmir on India's map;
# Gilgit-Baltistan, the Shaksgam valley and Aksai Chin to the UT of Ladakh.
"$MS" -i claims.json -clip ajk.json -each 'st = "JK", name = "Jammu and Kashmir"' -filter-fields st,name \
  -o claim_jk.json format=geojson force
"$MS" -i claims.json -erase ajk.json -explode -each 'km2 = this.area / 1e6' -filter 'km2 > 200' \
  -each 'st = "LA", name = "Ladakh"' -filter-fields st,name -o claim_la.json format=geojson force
"$MS" -i states_raw.json claim_jk.json claim_la.json combine-files -merge-layers force name=states \
  -dissolve st copy-fields=name -o states_full.json format=geojson force
# neighbours for context (India's point of view), clipped to the region
"$MS" -i ne10_ind.geojson -filter '["PAK","CHN","NPL","BGD","LKA","BTN","MMR","AFG","TJK","MDV","IRN","THA","LAO","KGZ","UZB","TKM","OMN","ARE"].indexOf(ADM0_A3) > -1' \
  -each 'name = NAME' -filter-fields name -clip bbox=58,2,104,40 -o neighbours.json format=geojson force
"$MS" -i states_full.json neighbours.json combine-files \
  -rename-layers states,neighbours \
  -simplify interval=2500 keep-shapes target=states \
  -simplify interval=6000 keep-shapes target=neighbours \
  -filter-islands min-area=30km2 remove-empty target=* \
  -o "$HERE/india.topo.json" format=topojson quantization=40000 force target=*
ls -la "$HERE"/*.topo.json
