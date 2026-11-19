// Fetch real OpenStreetMap (ODbL) GIS data for Central Tashkent via Overpass API
// Bounding box: South=41.272, West=69.205, North=41.352, East=69.318
import fs from 'node:fs';
import path from 'node:path';

const ORIGIN_LAT = 41.3102;
const ORIGIN_LON = 69.2780;
const SCALE_X = 17795; // meters per degree longitude in game world (-2500..+2500)
const SCALE_Z = 23726; // meters per degree latitude in game world (-2500..+2500)

function toXZ(lat, lon) {
  return [
    Math.round((lon - ORIGIN_LON) * SCALE_X),
    Math.round((ORIGIN_LAT - lat) * SCALE_Z),
  ];
}

function simplifyPolyline(pts, tol = 14) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = pts[i];
    if (Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) >= tol) {
      out.push(cur);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const query = `
[out:json][timeout:30];
(
  way["highway"~"^(trunk|primary|secondary|tertiary)$"](41.280,69.215,41.345,69.310);
  way["waterway"~"^(river|canal)$"](41.275,69.210,41.350,69.315);
  way["natural"="water"](41.285,69.225,41.342,69.305);
  way["leisure"="park"](41.285,69.225,41.342,69.305);
  way["building"]["name"](41.290,69.225,41.340,69.305);
  way["building"]["building:levels"](41.302,69.242,41.325,69.288);
);
out body geom qt;
`;

async function main() {
  console.log('[OSM] Querying Overpass API for Central Tashkent...');
  const endpoints = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ];

  let data = null;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TungiToshkent3D-GIS/1.0 (https://tungitoshkent.uz)',
        },
        body: 'data=' + encodeURIComponent(query),
      });
      console.log('[OSM] Status from', url, res.status);
      if (res.ok) {
        data = await res.json();
        console.log('[OSM] Success from', url, 'elements:', data.elements?.length);
        break;
      }
    } catch (err) {
      console.warn('[OSM] Failed endpoint', url, err.message);
    }
  }

  if (!data || !data.elements) {
    throw new Error('Could not fetch OSM Overpass data');
  }

  const roads = [];
  const waterways = [];
  const lakes = [];
  const parks = [];
  const buildings = [];
  let totalRoadKm = 0;

  for (const el of data.elements) {
    if (!el.geometry || el.geometry.length < 2) continue;
    const tags = el.tags || {};
    const rawPts = el.geometry.map((pt) => toXZ(pt.lat, pt.lon));

    if (tags.highway) {
      const pts = simplifyPolyline(rawPts, tags.highway === 'tertiary' ? 22 : 14);
      if (pts.length < 2) continue;
      let lenM = 0;
      for (let i = 1; i < pts.length; i++) {
        lenM += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      }
      if (lenM < 45) continue;
      totalRoadKm += lenM / 1000;
      roads.push({
        id: el.id,
        type: tags.highway,
        name: tags['name:uz'] || tags.name || '',
        lanes: Number(tags.lanes) || (tags.highway === 'trunk' || tags.highway === 'primary' ? 4 : 2),
        oneway: tags.oneway === 'yes' ? 1 : 0,
        bridge: tags.bridge === 'yes' ? 1 : 0,
        tunnel: tags.tunnel === 'yes' ? 1 : 0,
        pts,
      });
    } else if (tags.waterway) {
      const pts = simplifyPolyline(rawPts, 18);
      if (pts.length >= 2) {
        waterways.push({
          id: el.id,
          type: tags.waterway,
          name: tags['name:uz'] || tags.name || 'Kanal',
          pts,
        });
      }
    } else if (tags.natural === 'water') {
      const pts = simplifyPolyline(rawPts, 14);
      if (pts.length >= 3) {
        lakes.push({
          id: el.id,
          name: tags['name:uz'] || tags.name || '',
          pts,
        });
      }
    } else if (tags.leisure === 'park') {
      const pts = simplifyPolyline(rawPts, 18);
      if (pts.length >= 3) {
        parks.push({
          id: el.id,
          name: tags['name:uz'] || tags.name || '',
          pts,
        });
      }
    } else if (tags.building) {
      const pts = simplifyPolyline(rawPts, 4);
      if (pts.length < 3) continue;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      let sx = 0, sz = 0;
      for (const [x, z] of pts) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
        sx += x;
        sz += z;
      }
      const w = maxX - minX;
      const d = maxZ - minZ;
      if (w < 10 && d < 10) continue;
      if (w > 220 || d > 220) continue;
      const levels = Number(tags['building:levels']) || 0;
      const height = Number(parseFloat(tags.height)) || (levels ? levels * 3.4 : 0);
      buildings.push({
        id: el.id,
        cx: Math.round(sx / pts.length),
        cz: Math.round(sz / pts.length),
        w: Math.round(w),
        d: Math.round(d),
        h: Math.round(height),
        lvl: levels,
        kind: tags.building === 'yes' ? (tags.amenity || tags.shop || 'b') : tags.building,
        name: tags['name:uz'] || tags.name || '',
        pts: pts.slice(0, 12),
      });
    }
  }

  // Sort buildings by area/importance and keep top 950 real OSM buildings for fast 60 FPS browser loading
  buildings.sort((a, b) => (b.name ? 5000 : 0) + b.h * 50 + b.w * b.d - ((a.name ? 5000 : 0) + a.h * 50 + a.w * a.d));
  const selectedBuildings = buildings.slice(0, 950);

  console.log(`[OSM] Extracted:
  - Roads: ${roads.length} segments (${totalRoadKm.toFixed(1)} km)
  - Waterways: ${waterways.length}
  - Lakes: ${lakes.length}
  - Parks: ${parks.length}
  - Buildings (total ${buildings.length}, selected ${selectedBuildings.length})`);

  const outCode = `// Real OpenStreetMap (ODbL) GIS Dataset for Central Tashkent
// Generated from live Overpass API query (41.275..41.348 N, 69.210..69.315 E)
// Attribution: © OpenStreetMap contributors (ODbL) — https://www.openstreetmap.org/copyright

export const TASHKENT_GIS_META = {
  source: 'OpenStreetMap Overpass API (ODbL)',
  originLat: ${ORIGIN_LAT},
  originLon: ${ORIGIN_LON},
  scaleX: ${SCALE_X},
  scaleZ: ${SCALE_Z},
  roadSegments: ${roads.length},
  totalRoadKm: ${Number(totalRoadKm.toFixed(1))},
  totalOsmBuildingsScanned: ${buildings.length},
  activeOsmBuildings: ${selectedBuildings.length},
  waterwayCount: ${waterways.length},
  parkCount: ${parks.length},
  lakeCount: ${lakes.length},
};

export function worldToLatLon(x, z) {
  return {
    lat: Number((${ORIGIN_LAT} - z / ${SCALE_Z}).toFixed(6)),
    lon: Number((${ORIGIN_LON} + x / ${SCALE_X}).toFixed(6)),
  };
}

export function latLonToWorld(lat, lon) {
  return {
    x: Math.round((lon - ${ORIGIN_LON}) * ${SCALE_X}),
    z: Math.round((${ORIGIN_LAT} - lat) * ${SCALE_Z}),
  };
}

export const OSM_ROADS = ${JSON.stringify(roads)};
export const OSM_WATERWAYS = ${JSON.stringify(waterways)};
export const OSM_LAKES = ${JSON.stringify(lakes)};
export const OSM_PARKS = ${JSON.stringify(parks)};
export const OSM_BUILDINGS = ${JSON.stringify(selectedBuildings)};
`;

  fs.writeFileSync(path.resolve('js/world/tashkentRealGis.js'), outCode, 'utf8');
  console.log('[OSM] Wrote js/world/tashkentRealGis.js successfully!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
