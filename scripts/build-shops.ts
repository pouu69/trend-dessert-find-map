/**
 * build-shops.ts
 *
 * Combines real shop data from Kakao Map and Naver Blog crawl results,
 * geocodes addresses via Nominatim, and writes data/shops.json.
 */

import * as fs from "fs";
import * as path from "path";

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

// ---------------------------------------------------------------------------
// Raw shop data from crawl results
// ---------------------------------------------------------------------------

interface RawShop {
  name: string;
  address: string;
  phone: string;
  tags: string[];
  description: string;
}

const rawShops: RawShop[] = [
  // --- Kakao Map crawl ---
  {
    name: "달리당 수원본점",
    address: "경기 수원시 팔달구 창룡대로80번길 15 1-3층",
    phone: "070-8668-5156",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
  {
    name: "연남허니밀크",
    address: "서울 마포구 양화로23길 10-14 1층",
    phone: "010-5584-7104",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
  {
    name: "수아카롱 본점",
    address: "경기 수원시 영통구 도청로18번길 26 힐스테이트광교중앙역상가 지하2층 B259호",
    phone: "0503-7153-8093",
    tags: ["디저트카페"],
    description: "상하이버터떡 판매 디저트카페",
  },
  {
    name: "코드91",
    address: "인천 강화군 화도면 마니산로 627 1층",
    phone: "0503-7153-6453",
    tags: ["커피전문점"],
    description: "상하이버터떡 판매 커피전문점",
  },
  {
    name: "모어커피랩",
    address: "전북특별자치도 전주시 덕진구 견훤로 424 1층",
    phone: "0503-7153-8083",
    tags: ["카페"],
    description: "상하이버터떡 판매 카페",
  },
  {
    name: "브리나케오슈",
    address: "제주특별자치도 제주시 애월읍 고내3길 21-2",
    phone: "0503-7152-8302",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
  // --- Naver Blog crawl ---
  {
    name: "하츠베이커리 노원점",
    address: "서울특별시 노원구 공릉로41길 6",
    phone: "",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
  {
    name: "하츠베이커리 논현점",
    address: "서울특별시 강남구 학동로 342",
    phone: "",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
  {
    name: "하츠베이커리 압구정점",
    address: "서울특별시 강남구 도산대로17길 10",
    phone: "",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
  {
    name: "하츠베이커리 선릉점",
    address: "서울특별시 강남구 선릉로161길 19",
    phone: "",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
  {
    name: "하츠베이커리 잠실점",
    address: "서울특별시 송파구 중대로 210",
    phone: "",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
  {
    name: "하츠베이커리 은평점",
    address: "서울특별시 은평구 진관4로 17",
    phone: "",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
  {
    name: "하츠베이커리 성수점",
    address: "서울특별시 성동구 성수이로24길 36",
    phone: "",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
  {
    name: "하츠베이커리 서초점",
    address: "서울특별시 서초구 강남대로91길 12",
    phone: "",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
  {
    name: "미구제과 본점",
    address: "대구광역시 달서구 와룡로49길 101",
    phone: "",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
  {
    name: "미구제과 범어점",
    address: "대구광역시 수성구 범어로24길 20",
    phone: "",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
  {
    name: "미구제과 봉산점",
    address: "대구광역시 중구 봉산문화길 43",
    phone: "",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
  {
    name: "미구제과 중앙점",
    address: "대구광역시 중구 중앙대로 354-34",
    phone: "",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
  {
    name: "미구제과 동구점",
    address: "대구광역시 동구 동부로 207",
    phone: "",
    tags: ["제과", "베이커리"],
    description: "상하이버터떡 판매 베이커리",
  },
];

// ---------------------------------------------------------------------------
// Region extraction
// ---------------------------------------------------------------------------

function extractRegion(address: string): string {
  if (/^서울(특별시)?/.test(address)) return "서울";
  if (/^경기/.test(address)) return "경기";
  if (/^인천/.test(address)) return "인천";
  if (/^대구(광역시)?/.test(address)) return "대구";
  if (/^전북(특별자치도)?/.test(address)) return "전북";
  if (/^제주(특별자치도)?/.test(address)) return "제주";
  return "";
}

// ---------------------------------------------------------------------------
// Nominatim geocoding
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Strip floor / building detail suffixes from a Korean address.
 * e.g. "... 15 1-3층" -> "... 15"
 *      "... 지하2층 B259호" -> removed
 *      "... 1층" -> removed
 */
function simplifyAddress(addr: string): string {
  // Remove tokens like "1층", "1-3층", "지하2층", "B259호", and building names in Korean
  return addr
    .replace(/\s+지하?\d[^\s]*/g, "")         // 지하2층 etc.
    .replace(/\s+[A-Z]?\d+호/g, "")            // B259호
    .replace(/\s+\d+-?\d*층/g, "")             // 1층, 1-3층
    .replace(/\s+힐스테이트[^\s]*/g, "")        // building names
    .trim();
}

/**
 * Extract road-level address (drop the detailed number part at the end).
 * e.g. "서울 마포구 양화로23길 10-14" -> "서울 마포구 양화로23길"
 */
function roadLevelAddress(addr: string): string {
  // Remove trailing number / number-number after the road name
  return addr.replace(/\s+\d+(-\d+)?$/, "").trim();
}

interface NominatimResult {
  lat: string;
  lon: string;
}

async function geocodeQuery(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=ko`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "shanghai-butter-rice-builder/1.0" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimResult[];
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  // Strategy 1: full address
  let result = await geocodeQuery(address);
  if (result) return result;

  await sleep(1100);

  // Strategy 2: simplified (no floor/building details)
  const simplified = simplifyAddress(address);
  if (simplified !== address) {
    result = await geocodeQuery(simplified);
    if (result) return result;
    await sleep(1100);
  }

  // Strategy 3: road-level only
  const roadLevel = roadLevelAddress(simplified);
  if (roadLevel !== simplified) {
    result = await geocodeQuery(roadLevel);
    if (result) return result;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const shops: Shop[] = [];

  for (let i = 0; i < rawShops.length; i++) {
    const raw = rawShops[i];
    const id = `shop-${String(i + 1).padStart(3, "0")}`;
    const region = extractRegion(raw.address);

    console.log(`[${i + 1}/${rawShops.length}] Geocoding ${raw.name} ...`);
    const coords = await geocodeAddress(raw.address);

    if (coords) {
      console.log(`  -> ${coords.lat}, ${coords.lng}`);
    } else {
      console.log(`  -> geocoding failed`);
    }

    shops.push({
      id,
      name: raw.name,
      address: raw.address,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      phone: raw.phone,
      hours: "",
      closedDays: [],
      priceRange: "",
      tags: raw.tags,
      description: raw.description,
      region,
    });

    // Rate-limit: 1.1s between requests (only if more to go)
    if (i < rawShops.length - 1) {
      await sleep(1100);
    }
  }

  // Write output
  const outPath = path.resolve(
    import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
    "../data/shops.json"
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(shops, null, 2) + "\n", "utf-8");

  console.log(`\nWrote ${shops.length} shops to ${outPath}`);

  const geocoded = shops.filter((s) => s.lat !== null).length;
  console.log(`Geocoded: ${geocoded}/${shops.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
