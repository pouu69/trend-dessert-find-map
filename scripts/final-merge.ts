import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Types ──────────────────────────────────────────────────────────────────
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

interface GmapResult {
  name: string;
  address: string;
  phone: string;
  hours: string;
  rating?: string;
  lat: number | null;
  lng: number | null;
  searchQuery?: string;
  note?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractRegion(address: string): string {
  const map: [RegExp, string][] = [
    [/^서울특별시|^서울\s/, "서울"],
    [/^경기도|^경기\s/, "경기"],
    [/^인천광역시|^인천\s/, "인천"],
    [/^부산광역시|^부산\s/, "부산"],
    [/^대구광역시|^대구\s/, "대구"],
    [/^광주광역시|^광주\s/, "광주"],
    [/^대전광역시|^대전\s/, "대전"],
    [/^전북특별자치도/, "전북"],
    [/^전라북도/, "전북"],
    [/^제주특별자치도|^제주\s/, "제주"],
    [/^경상남도|^경남\s/, "경남"],
    [/^경상북도|^경북\s/, "경북"],
    [/^강원특별자치도|^강원도|^강원\s/, "강원"],
    [/^충청남도|^충남\s/, "충남"],
    [/^충청북도|^충북\s/, "충북"],
    [/^전라남도|^전남\s/, "전남"],
    [/^부산진구/, "부산"],
  ];
  for (const [re, region] of map) {
    if (re.test(address)) return region;
  }
  return "";
}

function normalizeForMatch(s: string): string {
  return s
    .replace(/\s+/g, "")
    .replace(/[()（）]/g, "")
    .replace(/[a-zA-Z]/g, "")
    .toLowerCase();
}

function cleanPhone(phone: string): string {
  return phone
    .replace(/^전화:\s*/, "")
    .replace(/\n.*/s, "")
    .trim();
}

function cleanHours(hours: string): string {
  let h = hours
    .replace(/이번 주 영업시간 표시/g, "")
    .replace(/, 영업시간 복사$/g, "")
    .replace(/^영업시간\s*/g, "")
    .replace(/영업 종료 · /g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Remove leading colon/dash
  h = h.replace(/^[:\-]\s*/, "").trim();
  if (!h || h === "영업시간") return "";
  return h;
}

function cleanAddress(addr: string): string {
  return addr
    .replace(/[\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDistrict(address: string): string {
  const m = address.match(/([\uac00-\ud7a3]+[구군])/);
  return m ? m[1] : "";
}

// ── Load data ──────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "..");
const shopsPath = path.join(ROOT, "data/shops.json");

const currentShops: Shop[] = JSON.parse(fs.readFileSync(shopsPath, "utf-8"));

const gmapFiles = [
  "gmap-seoul-results.json",
  "gmap-gyeonggi-results.json",
  "gmap-regions-results.json",
  "gmap-batch3-results.json",
  "gmap-batch1-results.json",
  "gmap-batch2-results.json",
];

const allGmapResults: GmapResult[] = [];
for (const f of gmapFiles) {
  const fp = path.join(ROOT, "scripts", f);
  if (fs.existsSync(fp)) {
    const data: GmapResult[] = JSON.parse(fs.readFileSync(fp, "utf-8"));
    allGmapResults.push(...data);
  }
}

// ── Deduplicate Google Maps results (skip generic/bad names) ───────────────

function isGenericGmapName(name: string): boolean {
  if (!name) return true;
  if (name === "검색 결과") return true;
  return false;
}

const gmapDeduped: GmapResult[] = [];
const gmapSeen = new Set<string>();
for (const g of allGmapResults) {
  if (isGenericGmapName(g.name)) continue;
  if (!g.address) continue;
  const key = normalizeForMatch(g.name) + "|" + normalizeForMatch(g.address);
  if (gmapSeen.has(key)) continue;
  gmapSeen.add(key);
  gmapDeduped.push(g);
}

console.log(`Loaded ${currentShops.length} shops from shops.json`);
console.log(`Loaded ${allGmapResults.length} Google Maps results (${gmapDeduped.length} unique after dedup)`);

// ── Step 1: Build the shop list starting from current shops ────────────────

const shops: Shop[] = [...currentShops];

// ── Step 2: Update existing shops from Google Maps data ────────────────────

function findGmapMatchForShop(shop: Shop): GmapResult | null {
  const shopNorm = normalizeForMatch(shop.name);
  const shopDist = extractDistrict(shop.address);

  // First pass: exact normalized name + same district
  for (const g of gmapDeduped) {
    const gNorm = normalizeForMatch(g.name);
    const gDist = extractDistrict(g.address);
    if (gNorm === shopNorm && shopDist && gDist && shopDist === gDist) return g;
  }

  // Second pass: name contains match + same district
  for (const g of gmapDeduped) {
    const gNorm = normalizeForMatch(g.name);
    const gDist = extractDistrict(g.address);
    if ((gNorm.includes(shopNorm) || shopNorm.includes(gNorm)) && gNorm.length > 2) {
      if (shopDist && gDist && shopDist === gDist) return g;
    }
  }

  // Third pass: exact name match (any location)
  for (const g of gmapDeduped) {
    const gNorm = normalizeForMatch(g.name);
    if (gNorm === shopNorm) return g;
  }

  return null;
}

let updatedCoords = 0;
let updatedPhone = 0;
let updatedHours = 0;

for (const shop of shops) {
  const gmap = findGmapMatchForShop(shop);
  if (!gmap) continue;

  // Update coordinates from Google Maps (more accurate)
  if (gmap.lat && gmap.lng) {
    shop.lat = gmap.lat;
    shop.lng = gmap.lng;
    updatedCoords++;
  }

  // Update phone if missing
  const cp = cleanPhone(gmap.phone);
  if (!shop.phone && cp) {
    shop.phone = cp;
    updatedPhone++;
  }

  // Update hours if missing
  const ch = cleanHours(gmap.hours);
  if (!shop.hours && ch) {
    shop.hours = ch;
    updatedHours++;
  }
}

console.log(`\nUpdated from Google Maps:`);
console.log(`  - ${updatedCoords} coordinates`);
console.log(`  - ${updatedPhone} phone numbers`);
console.log(`  - ${updatedHours} hours`);

// ── Step 3: Add new shops from Google Maps ─────────────────────────────────

function findGmapByNameSubstring(name: string): GmapResult | undefined {
  const norm = normalizeForMatch(name);
  return gmapDeduped.find((g) => {
    const gNorm = normalizeForMatch(g.name);
    return gNorm.includes(norm) || norm.includes(gNorm);
  });
}

function shopExists(name: string, address?: string): boolean {
  const norm = normalizeForMatch(name);
  return shops.some((s) => {
    const sNorm = normalizeForMatch(s.name);
    if (sNorm === norm) return true;
    if (sNorm.includes(norm) || norm.includes(sNorm)) {
      if (address) {
        const aDist = extractDistrict(address);
        const sDist = extractDistrict(s.address);
        return aDist === sDist;
      }
      return true;
    }
    return false;
  });
}

function addShop(name: string, gmap: GmapResult, tags: string[] = ["베이커리"]) {
  const addr = cleanAddress(gmap.address);
  const region = extractRegion(addr);
  shops.push({
    id: "",
    name,
    address: addr,
    lat: gmap.lat,
    lng: gmap.lng,
    phone: cleanPhone(gmap.phone),
    hours: cleanHours(gmap.hours),
    closedDays: [],
    priceRange: "",
    tags,
    description: "상하이버터떡 판매",
    region,
  });
}

// New shops to add from Google Maps
const newShopDefs: { name: string; searchName: string; tags?: string[] }[] = [
  { name: "김덕규과자점", searchName: "김덕규과자점" },
  { name: "겐츠베이커리 롯데백화점부산본점", searchName: "겐츠베이커리" },
  { name: "앙베이커리", searchName: "앙베이커리" },
  { name: "스칼렛 베이커리", searchName: "스칼렛 베이커리" },
  { name: "디저트39 부평역점", searchName: "디저트39 부평역점", tags: ["디저트카페"] },
  { name: "디저트39 광주상무지구점", searchName: "디저트39 광주상무지구점", tags: ["디저트카페"] },
  { name: "디저트39 전대점", searchName: "디저트39 전대점", tags: ["디저트카페"] },
  { name: "휘도르", searchName: "휘도르" },
  { name: "크림집", searchName: "크림집", tags: ["디저트카페"] },
  { name: "그런느낌", searchName: "그런느낌", tags: ["카페"] },
  { name: "모리베이커리", searchName: "모리베이커리" },
  // hatseu bakery stores found in gmap
  { name: "하츠베이커리 송파점", searchName: "하츠베이커리 송파점" },
];

let addedCount = 0;
for (const { name, searchName, tags } of newShopDefs) {
  const gmap = findGmapByNameSubstring(searchName);
  if (!gmap) {
    console.log(`  WARNING: Could not find Google Maps data for "${name}" (searched: "${searchName}")`);
    continue;
  }

  if (shopExists(name, gmap.address)) {
    continue;
  }

  addShop(name, gmap, tags || ["베이커리"]);
  addedCount++;
  console.log(`  + Added: ${name} (${cleanAddress(gmap.address)})`);
}

console.log(`\nAdded ${addedCount} new shops from Google Maps`);

// ── Step 4: Clean up all entries ───────────────────────────────────────────

for (const shop of shops) {
  shop.address = cleanAddress(shop.address);
  shop.phone = cleanPhone(shop.phone);
  shop.hours = cleanHours(shop.hours);
  if (!shop.region) shop.region = extractRegion(shop.address);
  if (!shop.description) shop.description = "상하이버터떡 판매";
}

// ── Step 5: Deduplicate by normalized name + district ──────────────────────

const dedupMap = new Map<string, Shop>();
for (const shop of shops) {
  const normName = normalizeForMatch(shop.name);
  const district = extractDistrict(shop.address);
  const key = `${normName}|${district}`;

  const existing = dedupMap.get(key);
  if (existing) {
    const score = (s: Shop) =>
      (s.lat ? 1 : 0) + (s.phone ? 1 : 0) + (s.hours ? 1 : 0) + (s.address.length > 10 ? 1 : 0);
    if (score(shop) > score(existing)) {
      dedupMap.set(key, shop);
    }
  } else {
    dedupMap.set(key, shop);
  }
}

let finalShops = Array.from(dedupMap.values());
const dedupRemoved = shops.length - finalShops.length;
console.log(`\nDeduplication removed ${dedupRemoved} entries`);

// ── Step 6: Final filter — must have address ───────────────────────────────

const beforeFilter = finalShops.length;
finalShops = finalShops.filter((s) => s.address && s.address.length > 5);
console.log(`Removed ${beforeFilter - finalShops.length} entries without valid address`);

// ── Step 7: Sort by region then name ───────────────────────────────────────

const regionOrder = [
  "서울", "경기", "인천", "부산", "대구", "광주", "대전",
  "강원", "충남", "충북", "전북", "전남", "경남", "경북", "제주",
];

finalShops.sort((a, b) => {
  const aIdx = regionOrder.indexOf(a.region);
  const bIdx = regionOrder.indexOf(b.region);
  const aOrder = aIdx === -1 ? 999 : aIdx;
  const bOrder = bIdx === -1 ? 999 : bIdx;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.name.localeCompare(b.name, "ko");
});

// ── Step 8: Re-index IDs ───────────────────────────────────────────────────

finalShops.forEach((shop, i) => {
  shop.id = `shop-${String(i + 1).padStart(3, "0")}`;
});

// ── Step 9: Write output ───────────────────────────────────────────────────

fs.writeFileSync(shopsPath, JSON.stringify(finalShops, null, 2) + "\n", "utf-8");

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`FINAL RESULT`);
console.log(`${"=".repeat(50)}`);
console.log(`Total shops: ${finalShops.length}`);

const byRegion = new Map<string, number>();
for (const s of finalShops) {
  const r = s.region || "(unknown)";
  byRegion.set(r, (byRegion.get(r) || 0) + 1);
}
console.log(`\nBreakdown by region:`);
for (const r of regionOrder) {
  const count = byRegion.get(r);
  if (count) console.log(`  ${r}: ${count}`);
}
const unknown = byRegion.get("(unknown)");
if (unknown) console.log(`  (unknown): ${unknown}`);

const withCoords = finalShops.filter((s) => s.lat && s.lng).length;
console.log(`\nWith coordinates: ${withCoords}/${finalShops.length}`);

const withPhone = finalShops.filter((s) => s.phone).length;
console.log(`With phone: ${withPhone}/${finalShops.length}`);

// Print all shops for review
console.log(`\nAll shops:`);
for (const s of finalShops) {
  const c = s.lat ? "Y" : "N";
  const p = s.phone ? "Y" : "N";
  console.log(`  ${s.id} [${s.region.padEnd(2)}] ${s.name.padEnd(20)} | coords:${c} phone:${p} | ${s.address.substring(0, 40)}`);
}
