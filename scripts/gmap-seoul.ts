/**
 * Google Maps Seoul shop data collector for 하츠베이커리 and 연남허니밀크
 *
 * This script was designed to search Google Maps for Shanghai Butter Rice Cake shops
 * in the Seoul region. The results have been pre-collected via browser automation
 * and saved to gmap-seoul-results.json.
 *
 * Key findings from the Google Maps search:
 * - Only 2 하츠베이커리 branches are registered on Google Maps: 송파점 and 성수점
 * - Searches for 노원/논현/압구정/선릉/잠실/은평/서초 all redirect to 송파점 or 성수점
 * - 하츠베이커리 송파점 is marked as 임시 휴업 (temporarily closed)
 * - 연남허니밀크 is registered at 마포구 양화로23길 10-14 1층
 *
 * Run with: npx tsx scripts/gmap-seoul.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ShopResult {
  name: string;
  address: string;
  phone: string;
  hours: string;
  rating: string;
  lat: number;
  lng: number;
  searchQuery: string;
  note?: string;
}

const SEARCH_QUERIES = [
  "하츠베이커리 노원",
  "하츠베이커리 논현",
  "하츠베이커리 압구정",
  "하츠베이커리 선릉",
  "하츠베이커리 잠실",
  "하츠베이커리 은평",
  "하츠베이커리 성수",
  "하츠베이커리 서초",
  "연남허니밀크 마포",
];

async function main() {
  const resultsPath = path.join(__dirname, "gmap-seoul-results.json");
  const results: ShopResult[] = JSON.parse(
    fs.readFileSync(resultsPath, "utf-8")
  );

  console.log("=== Google Maps Seoul Shop Data ===\n");
  console.log(`Total search queries: ${SEARCH_QUERIES.length}`);
  console.log(`Total results: ${results.length}\n`);

  // Deduplicate by name
  const uniqueShops = new Map<string, ShopResult>();
  for (const r of results) {
    if (!uniqueShops.has(r.name)) {
      uniqueShops.set(r.name, r);
    }
  }

  console.log(`Unique shops found on Google Maps: ${uniqueShops.size}\n`);
  console.log("--- Unique Shops ---\n");

  for (const [name, shop] of uniqueShops) {
    console.log(`  ${name}`);
    console.log(`    Address: ${shop.address}`);
    console.log(`    Phone:   ${shop.phone || "(not listed)"}`);
    console.log(`    Hours:   ${shop.hours || "(not listed)"}`);
    console.log(`    Rating:  ${shop.rating}`);
    console.log(
      `    Coords:  ${shop.lat}, ${shop.lng}`
    );
    console.log();
  }

  console.log("--- Search Query Results ---\n");

  for (const r of results) {
    const status = r.note ? ` [${r.note}]` : "";
    console.log(`  "${r.searchQuery}" -> ${r.name}${status}`);
  }

  console.log(
    "\n--- Summary ---\n"
  );
  console.log(
    "Most 하츠베이커리 branch searches (노원/논현/압구정/선릉/잠실/은평/서초)"
  );
  console.log(
    "redirect to either 송파점 or 성수점, indicating these branches are"
  );
  console.log(
    "not separately registered on Google Maps."
  );
  console.log(
    "\n하츠베이커리 송파점 is marked as 임시 휴업 (temporarily closed)."
  );
  console.log(
    "하츠베이커리 성수점 has hours: 화~일 AM 10:30 open."
  );
  console.log(
    "연남허니밀크 is found at 마포구 양화로23길 10-14 1층."
  );
}

main().catch(console.error);
