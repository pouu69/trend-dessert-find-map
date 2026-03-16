import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SHOPS_PATH = path.join(ROOT, "src/data/shops.json");
const NAVER_PATH = path.join(ROOT, "scripts/naver-place-results.json");
const GEOCODE_LIMIT = 60;
const NOMINATIM_DELAY = 1100; // 1.1s

interface Shop {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  hours: string;
  closedDays: string[];
  priceRange: string;
  tags: string[];
  description: string;
  region: string;
}

interface NaverEntry {
  name: string;
  address: string;
  phone: string;
  hours: string;
  category: string;
  source: string;
}

// ── Address parsing ──
function cleanAddress(raw: string): string {
  // Remove "주소" prefix
  let addr = raw.replace(/^주소/, "");

  // Cut at "지도" if present
  const jiDoIdx = addr.indexOf("지도");
  if (jiDoIdx !== -1) {
    addr = addr.substring(0, jiDoIdx);
  }

  // Remove trailing station/distance info (e.g. "5서대문역 1번 출구에서 357m미터")
  // This pattern: number + station name + exit info
  addr = addr.replace(/\d+[가-힣]+역\s*\d+번\s*출구.*$/, "");
  // Also remove trailing distance info without station
  addr = addr.replace(/\d+m미터.*$/, "");

  // Remove trailing shop name that follows the address
  // Strategy: find floor indicators (층, B1, B2) or room numbers (호) and cut after them
  // Also handle cases where the shop name is appended directly

  // Match patterns like "1층", "2층", "지하1층", "B1", "101호", "102호"
  const floorMatch = addr.match(
    /(\d+층|지하\d+층|B\d+|[0-9]+호)(\s*,\s*\d+호)*/
  );
  if (floorMatch) {
    const lastFloorEnd = addr.indexOf(floorMatch[0]) + floorMatch[0].length;
    // Check if there's a shop name after the floor
    const afterFloor = addr.substring(lastFloorEnd);
    // If what follows starts with a space and then Korean text that looks like a shop name, trim it
    // But keep things like ", 102호" or building names that are part of the address
    const shopNameAfterFloor = afterFloor.match(
      /^\s+[가-힣a-zA-Z][가-힣a-zA-Z0-9\s.]+$/
    );
    if (shopNameAfterFloor) {
      // Check if it looks like a shop name (not a dong/building part of address)
      const possibleName = shopNameAfterFloor[0].trim();
      // If it contains dots or English mixed with Korean, likely a shop name
      if (
        possibleName.includes(".") ||
        /[a-zA-Z]/.test(possibleName) ||
        possibleName.length > 10
      ) {
        addr = addr.substring(0, lastFloorEnd);
      }
    }
  }

  // If no floor indicator, try to detect where address ends and shop name begins
  // Korean addresses typically end with a number (building number) or 동/호
  if (!floorMatch) {
    // Try to detect trailing shop name: after the last number in the address
    const parts = addr.split(/\s+/);
    let cutIdx = parts.length;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      // If this part is purely Korean and doesn't look like an address component
      if (
        /^[가-힣]+$/.test(p) &&
        !/(시|구|동|읍|면|리|로|길|번길|대로)$/.test(p)
      ) {
        cutIdx = i;
      } else {
        break;
      }
    }
    if (cutIdx < parts.length) {
      // Only cut if we'd be removing what looks like a shop name, not address parts
      const removed = parts.slice(cutIdx).join(" ");
      if (removed.length > 2) {
        addr = parts.slice(0, cutIdx).join(" ");
      }
    }
  }

  // Clean up: remove parenthetical notes like "(명륜진사갈비 맞은편)"
  addr = addr.replace(/\([^)]*\)/, "").trim();

  // Remove trailing dots and spaces
  addr = addr.replace(/[\s.]+$/, "").trim();

  return addr;
}

// ── Region extraction ──
function extractRegion(address: string): string {
  const regionMap: Record<string, string> = {
    서울: "서울",
    경기: "경기",
    인천: "인천",
    부산: "부산",
    대구: "대구",
    대전: "대전",
    광주: "광주",
    울산: "울산",
    세종: "세종",
    강원: "강원",
    충북: "충북",
    충남: "충남",
    전북: "전북",
    전남: "전남",
    경북: "경북",
    경남: "경남",
    제주: "제주",
  };

  for (const [key, val] of Object.entries(regionMap)) {
    if (address.startsWith(key)) return val;
  }
  return "기타";
}

// ── Extract district for description ──
function extractDistrict(address: string): string {
  // e.g. "서울 서대문구 ..." → "서대문구"
  // e.g. "경기 양주시 ..." → "양주시"
  const m = address.match(/\s([가-힣]+[시구군])\s/);
  return m ? m[1] : "";
}

// ── Category to tags ──
function categoryToTags(category: string): string[] {
  if (!category) return [];
  return category
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// ── Category to description ──
function buildDescription(
  category: string,
  region: string,
  district: string
): string {
  const tags = categoryToTags(category);
  const mainTag = tags[0] || "매장";
  const loc = district ? `${region} ${district}` : region;
  return `${mainTag} · ${loc}에 위치한 상하이버터떡 판매 매장`;
}

// ── Simplify address for geocoding (strip floor/room/building names) ──
function simplifyForGeocode(address: string): string {
  let a = address;
  // Remove floor info: "1층", "지하1층", "B1" etc and everything after
  a = a.replace(/\s*(지하)?\d+층.*$/, "");
  a = a.replace(/\s*B\d+.*$/, "");
  // Remove room numbers: "101호" etc
  a = a.replace(/\s*\d+호.*$/, "");
  // Remove building/complex names after the number (Korean text after last number)
  a = a.replace(/(\d+[-\d]*)\s+[가-힣A-Za-z].*$/, "$1");
  return a.trim();
}

// ── Geocoding ──
async function geocode(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const simplified = simplifyForGeocode(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simplified)}&countrycodes=kr&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "shanghai-butter-rice-app/1.0" },
    });
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function normalize(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

// ── Main ──
async function main() {
  const existing: Shop[] = JSON.parse(fs.readFileSync(SHOPS_PATH, "utf-8"));
  const naver: NaverEntry[] = JSON.parse(
    fs.readFileSync(NAVER_PATH, "utf-8")
  );

  console.log(`Existing shops: ${existing.length}`);
  console.log(`Naver Place entries: ${naver.length}`);

  // Build set of existing names for dedup
  const existingNames = new Set(existing.map((s) => normalize(s.name)));

  // Process naver entries
  const newShops: Shop[] = [];
  let dupeCount = 0;

  for (const entry of naver) {
    const normName = normalize(entry.name);
    if (existingNames.has(normName)) {
      dupeCount++;
      continue;
    }
    // Mark as seen to avoid intra-naver dupes
    existingNames.add(normName);

    const address = cleanAddress(entry.address);
    const region = extractRegion(address);
    const district = extractDistrict(address);

    newShops.push({
      id: "", // will assign later
      name: entry.name,
      address,
      lat: null,
      lng: null,
      phone: entry.phone || "",
      hours: entry.hours || "",
      closedDays: [],
      priceRange: "",
      tags: categoryToTags(entry.category),
      description: buildDescription(entry.category, region, district),
      region,
    });
  }

  console.log(`Duplicates skipped: ${dupeCount}`);
  console.log(`New shops to add: ${newShops.length}`);

  // Geocode first GEOCODE_LIMIT new shops
  const toGeocode = newShops.slice(0, GEOCODE_LIMIT);
  let geocoded = 0;

  console.log(`Geocoding ${toGeocode.length} shops...`);
  for (let i = 0; i < toGeocode.length; i++) {
    const shop = toGeocode[i];
    const result = await geocode(shop.address);
    if (result) {
      shop.lat = result.lat;
      shop.lng = result.lng;
      geocoded++;
    }
    if (i < toGeocode.length - 1) {
      await sleep(NOMINATIM_DELAY);
    }
    if ((i + 1) % 10 === 0) {
      console.log(`  geocoded ${i + 1}/${toGeocode.length} (${geocoded} successful)`);
    }
  }
  console.log(
    `Geocoding complete: ${geocoded}/${toGeocode.length} successful`
  );

  // Merge all shops
  const allShops = [...existing, ...newShops];

  // Sort by region then name
  const regionOrder = [
    "서울",
    "경기",
    "인천",
    "강원",
    "대전",
    "세종",
    "충북",
    "충남",
    "대구",
    "경북",
    "부산",
    "울산",
    "경남",
    "광주",
    "전북",
    "전남",
    "제주",
    "기타",
  ];
  allShops.sort((a, b) => {
    const ra = regionOrder.indexOf(a.region);
    const rb = regionOrder.indexOf(b.region);
    const regionA = ra === -1 ? 999 : ra;
    const regionB = rb === -1 ? 999 : rb;
    if (regionA !== regionB) return regionA - regionB;
    return a.name.localeCompare(b.name, "ko");
  });

  // Re-index IDs from shop-001
  allShops.forEach((shop, i) => {
    shop.id = `shop-${String(i + 1).padStart(3, "0")}`;
  });

  // Write
  fs.writeFileSync(SHOPS_PATH, JSON.stringify(allShops, null, 2) + "\n");

  console.log(`\n=== Summary ===`);
  console.log(`Total shops: ${allShops.length}`);
  console.log(`New shops added: ${newShops.length}`);
  console.log(`Geocoded: ${geocoded}`);
  console.log(`Written to: ${SHOPS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
