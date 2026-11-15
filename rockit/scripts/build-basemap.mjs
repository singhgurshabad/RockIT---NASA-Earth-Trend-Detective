// Rebuilds public/basemap/*.geojson from Natural Earth (public domain), as packaged by
// the "world-atlas" npm module. The output is committed, so you only need this script
// if you want a different level of detail.
//
//   npm install --no-save world-atlas topojson-client
//   node scripts/build-basemap.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { feature, mesh } from "topojson-client";

const require = createRequire(import.meta.url);
const read = (name) => JSON.parse(readFileSync(require.resolve(`world-atlas/${name}`), "utf8"));
const round = (c) => (typeof c[0] === "number" ? [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100] : c.map(round));

// world-atlas stores shapes on a sphere, so a coastline that crosses the 180 degree meridian
// jumps from +180 to -180 in the middle of a ring. A flat renderer would draw that jump as a
// band right around the planet. These helpers make longitudes continuous instead (179, 181, 183
// rather than 179, -179, -177); MapLibre wraps the part beyond 180 back to the other side.
function unwrapLine(line) {
  const out = [];
  let shift = 0;
  for (let i = 0; i < line.length; i += 1) {
    if (i > 0) {
      const step = line[i][0] - line[i - 1][0];
      if (step > 180) shift -= 360;
      else if (step < -180) shift += 360;
    }
    out.push([line[i][0] + shift, line[i][1]]);
  }
  return out;
}

// Shift a whole line by full turns so that its middle lies between -180 and 180.
function recentre(line) {
  const lons = line.map((p) => p[0]);
  const middle = (Math.min(...lons) + Math.max(...lons)) / 2;
  const turns = Math.round(middle / 360) * 360;
  return turns === 0 ? line : line.map((p) => [p[0] - turns, p[1]]);
}

function unwrapRing(ring) {
  const out = recentre(unwrapLine(ring));
  const first = out[0];
  const last = out[out.length - 1];
  if (Math.abs(last[0] - first[0]) > 180) {
    // The ring goes all the way round a pole (Antarctica). Close it through the pole.
    const pole = out.reduce((sum, p) => sum + p[1], 0) < 0 ? -90 : 90;
    out.push([last[0], pole], [first[0], pole], first);
  }
  return out;
}

const land = read("land-50m.json");
const countries = read("countries-50m.json");

const landFeature = feature(land, land.objects.land);
const rawLand = landFeature.features ? landFeature.features[0].geometry : landFeature.geometry;
const atPole = (ring) => ring.every((p) => Math.abs(p[1]) > 89.9); // a zero-area ring sitting on the pole
const landGeometry = {
  type: "MultiPolygon",
  coordinates: rawLand.coordinates.map((polygon) => polygon.filter((ring) => !atPole(ring)).map(unwrapRing)),
};
// Interior borders only (a line shared by two different countries), so coastlines are not drawn twice.
const rawBorders = mesh(countries, countries.objects.countries, (a, b) => a !== b);
const borders = { type: "MultiLineString", coordinates: rawBorders.coordinates.map((line) => recentre(unwrapLine(line))) };

mkdirSync("public/basemap", { recursive: true });
const write = (file, geometry) => {
  const json = JSON.stringify({
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: geometry.type, coordinates: round(geometry.coordinates) } }],
  });
  writeFileSync(`public/basemap/${file}`, json);
  console.log(file, Math.round(json.length / 1024), "KB");
};
write("land.geojson", landGeometry);
write("borders.geojson", borders);
