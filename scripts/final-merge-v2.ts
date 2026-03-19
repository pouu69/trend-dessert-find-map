import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHOPS_PATH = path.join(__dirname, "../data/shops.json");

interface Shop {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  hours: string;
  closedDays: string[];
  priceRange: string;
  tags: string[];
  description: string;
  region: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "ShanghaiButterRiceMap/1.0";

async function geocode(address: string): Promise<{ lat: number; lng: number }> {
  const attempts = [address];
  // Simplified: remove building number details after last space if it has digits
  const simplified = address
    .replace(/\s+\d+[-\d]*호?$/, "")
    .replace(/\s+\d+층$/, "")
    .replace(/\s+[A-Z]?\d+$/, "");
  if (simplified !== address) attempts.push(simplified);

  for (const q of attempts) {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=kr`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    await delay(1100);
  }
  return { lat: 0, lng: 0 };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Region sort order for consistent ordering
const REGION_ORDER: Record<string, number> = {
  서울: 1,
  경기: 2,
  인천: 3,
  부산: 4,
  대구: 5,
  대전: 6,
  광주: 7,
  울산: 8,
  전북: 9,
  전남: 10,
  충남: 11,
  충북: 12,
  경남: 13,
  경북: 14,
  강원: 15,
  제주: 16,
};

async function main() {
  const shops: Shop[] = JSON.parse(fs.readFileSync(SHOPS_PATH, "utf-8"));
  console.log(`Loaded ${shops.length} existing shops`);

  // Step 1: Add 8 new shops
  const newShops: Omit<Shop, "id" | "lat" | "lng">[] = [
    {
      name: "버터라이스클럽",
      address: "서울특별시 용산구 한강대로7길 22-17",
      phone: "",
      hours: "",
      closedDays: [],
      priceRange: "",
      tags: ["인기맛집"],
      description: "상하이버터떡 판매",
      region: "서울",
    },
    {
      name: "창억떡집",
      address: "서울특별시 서초구 강남대로53길 12",
      phone: "",
      hours: "",
      closedDays: [],
      priceRange: "",
      tags: ["떡집"],
      description: "상하이버터떡 판매",
      region: "서울",
    },
    {
      name: "조안나카페",
      address: "경기도 시흥시 은계중앙로 247",
      phone: "010-4965-1734",
      hours: "",
      closedDays: [],
      priceRange: "",
      tags: ["카페"],
      description: "상하이버터떡 판매 카페",
      region: "경기",
    },
    {
      name: "파밀리아제과점",
      address: "부산광역시 사상구 대동로 101",
      phone: "",
      hours: "",
      closedDays: [],
      priceRange: "",
      tags: ["제과점"],
      description: "상하이버터떡 판매",
      region: "부산",
    },
    {
      name: "마미공방",
      address: "대전광역시 서구 신갈마로 46",
      phone: "",
      hours: "",
      closedDays: [],
      priceRange: "",
      tags: ["베이커리"],
      description: "상하이버터떡 판매",
      region: "대전",
    },
    {
      name: "지우제과",
      address: "충남 아산시 배방읍 광장로",
      phone: "07-1445-0803",
      hours: "",
      closedDays: [],
      priceRange: "",
      tags: ["제과점"],
      description: "상하이버터떡 판매",
      region: "충남",
    },
    {
      name: "도우트리베이커리카페",
      address: "울산광역시 울주군 서생면 해맞이로",
      phone: "",
      hours: "",
      closedDays: [],
      priceRange: "",
      tags: ["베이커리카페"],
      description: "상하이버터떡 판매",
      region: "울산",
    },
    {
      name: "진진제과",
      address: "제주특별자치도 제주시 신설로4길 4",
      phone: "064-723-7655",
      hours: "",
      closedDays: [],
      priceRange: "",
      tags: ["베이커리"],
      description: "상하이버터떡 판매",
      region: "제주",
    },
  ];

  // Step 2: Geocode new shops
  console.log("\nGeocoding 8 new shops...");
  const fullNewShops: Shop[] = [];
  for (const shop of newShops) {
    console.log(`  Geocoding: ${shop.name} (${shop.address})`);
    const coords = await geocode(shop.address);
    console.log(`    -> lat: ${coords.lat}, lng: ${coords.lng}`);
    fullNewShops.push({
      ...shop,
      id: "",
      lat: coords.lat,
      lng: coords.lng,
    });
    await delay(1100);
  }

  // Add new shops to array
  shops.push(...fullNewShops);

  // Step 3: Update phone numbers for existing shops
  const phoneUpdates: Record<string, string> = {
    연남허니밀크: "02-3144-7104",
    "달리당 수원본점": "050-71427-7729",
    모어커피랩: "050-71317-9499",
    브리나케오슈: "050-71441-9086",
    앙베이커리: "070-8270-3689",
  };

  console.log("\nUpdating phone numbers...");
  for (const shop of shops) {
    if (phoneUpdates[shop.name]) {
      const oldPhone = shop.phone;
      shop.phone = phoneUpdates[shop.name];
      console.log(`  ${shop.name}: ${oldPhone} -> ${shop.phone}`);
    }
  }

  // Step 4: Sort by region then name, re-index
  shops.sort((a, b) => {
    const regionA = REGION_ORDER[a.region] ?? 99;
    const regionB = REGION_ORDER[b.region] ?? 99;
    if (regionA !== regionB) return regionA - regionB;
    return a.name.localeCompare(b.name, "ko");
  });

  shops.forEach((shop, i) => {
    shop.id = `shop-${String(i + 1).padStart(3, "0")}`;
  });

  // Write final result
  fs.writeFileSync(SHOPS_PATH, JSON.stringify(shops, null, 2) + "\n", "utf-8");
  console.log(`\nWrote ${shops.length} shops to ${SHOPS_PATH}`);

  // Step 5: Summary
  console.log("\n=== FINAL SUMMARY ===");
  console.log(`Total shops: ${shops.length}`);

  const regionCounts: Record<string, number> = {};
  for (const shop of shops) {
    regionCounts[shop.region] = (regionCounts[shop.region] || 0) + 1;
  }

  console.log("\nRegional breakdown:");
  const sortedRegions = Object.entries(regionCounts).sort(
    ([a], [b]) => (REGION_ORDER[a] ?? 99) - (REGION_ORDER[b] ?? 99)
  );
  for (const [region, count] of sortedRegions) {
    console.log(`  ${region}: ${count}`);
  }

  console.log("\nAll shops:");
  for (const shop of shops) {
    const coords =
      shop.lat !== 0 ? `(${shop.lat}, ${shop.lng})` : "(no coords)";
    console.log(
      `  ${shop.id} | ${shop.region} | ${shop.name} | ${shop.phone || "-"} | ${coords}`
    );
  }
}

main().catch(console.error);
