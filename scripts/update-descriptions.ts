import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shopsPath = path.join(__dirname, "../data/shops.json");
const gmapAPath = path.join(__dirname, "gmap-info-a.json");
const gmapCPath = path.join(__dirname, "gmap-info-c.json");

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

interface GmapEntry {
  searchQuery: string;
  name: string;
  rating: string;
  reviewCount: string;
  category: string;
  description: string;
  reviewSnippet: string;
}

const shops: Shop[] = JSON.parse(fs.readFileSync(shopsPath, "utf-8"));
const gmapA: GmapEntry[] = JSON.parse(fs.readFileSync(gmapAPath, "utf-8"));
const gmapC: GmapEntry[] = JSON.parse(fs.readFileSync(gmapCPath, "utf-8"));
const allGmap = [...gmapA, ...gmapC];

// Extract district/neighborhood from address
function getDistrict(address: string): string {
  // Try to get 구/군/읍/면 but skip city-level names like 대구광역시
  const match = address.match(/(?:광역시|특별시|특별자치시|특별자치도)\s+([\w가-힣]+[구군])/);
  if (match) return match[1];
  // Fallback: match 시 다음의 구
  const match2 = address.match(/시\s+([\w가-힣]+[구군])/);
  if (match2) return match2[1];
  // Try 읍/면
  const match3 = address.match(/([\w가-힣]+[읍면])/);
  if (match3) return match3[1];
  return "";
}

function getNeighborhood(address: string): string {
  // Try to get 동
  const match = address.match(/([\w가-힣]+동)/);
  return match ? match[1] : "";
}

// Location-specific descriptors for shops
function getLocationNote(shop: Shop): string {
  const district = getDistrict(shop.address);
  const neighborhood = getNeighborhood(shop.address);

  if (neighborhood && district) {
    return `${district} ${neighborhood}`;
  }
  if (district) return district;
  return shop.region;
}

// Build descriptions based on the matching table provided
function buildDescription(shop: Shop): { description: string; newTags: string[] } {
  const newTags: string[] = [];

  // Specific matches based on the provided table
  const matchMap: Record<string, {
    rating?: string;
    reviewCount?: string;
    category?: string;
    note: string;
  }> = {
    "버터라이스클럽": {
      rating: "4.5",
      note: "용산의 인기 상하이버터떡 전문점",
    },
    "연남허니밀크": {
      rating: "5.0",
      category: "제과점",
      note: "연남동에 위치한 상하이버터떡 판매 베이커리",
    },
    "창억떡집": {
      category: "떡집",
      note: "서초구에 위치한 전통 떡집에서 상하이버터떡 판매",
    },
    "하츠베이커리 성수점": {
      rating: "5.0",
      reviewCount: "1",
      category: "제과점",
      note: "성수동에 위치한 상하이버터떡 전문 베이커리",
    },
    "하츠베이커리 송파점": {
      rating: "4.0",
      category: "카페",
      note: "현재 임시 휴업 중인 송파구 베이커리",
    },
    "달리당 수원본점": {
      rating: "4.6",
      category: "카페",
      note: "수원 팔달구에서 상하이버터떡과 디저트를 즐길 수 있는 카페",
    },
    "수아카롱 본점": {
      category: "제과점",
      note: "수원 영통 광교중앙역 인근 마카롱과 상하이버터떡을 판매하는 디저트 전문점",
    },
    "스칼렛 베이커리": {
      rating: "4.5",
      category: "디저트 전문점",
      note: "분당에서 상하이버터떡을 포함한 다양한 디저트를 판매하는 베이커리",
    },
    "앙베이커리": {
      rating: "5.0",
      category: "카페",
      note: "분당 정자동에서 이른 아침부터 상하이버터떡을 만날 수 있는 베이커리 카페",
    },
    "디저트39 부평역점": {
      rating: "4.8",
      category: "카페",
      note: "부평역 인근 상하이버터떡을 판매하는 디저트 프랜차이즈",
    },
    "코드91": {
      category: "커피숍",
      note: "강화도 마니산 인근에서 상하이버터떡을 함께 즐길 수 있는 카페",
    },
    "미구제과 범어점": {
      rating: "4.7",
      reviewCount: "6",
      category: "카페",
      note: "대구 수성구 범어동에서 상하이버터떡을 판매하는 제과점",
    },
    "미구제과 봉산점": {
      rating: "5.0",
      reviewCount: "20",
      category: "카페",
      note: "대구 중구 봉산동의 인기 상하이버터떡 제과점",
    },
    "겐츠베이커리 롯데백화점부산본점": {
      category: "베이커리",
      note: "부산 롯데백화점 B1층에 위치한 상하이버터떡 판매 베이커리",
    },
    "모어커피랩": {
      category: "카페",
      note: "전주 덕진구에서 상하이버터떡과 커피를 함께 즐길 수 있는 카페",
    },
    "브리나케오슈": {
      category: "베이커리",
      note: "제주 애월읍에 위치한 상하이버터떡 판매 베이커리",
    },
    "김덕규과자점": {
      rating: "4.2",
      category: "제과점",
      note: "김해의 전통 과자점에서 상하이버터떡 판매",
    },
    "진진제과": {
      category: "베이커리",
      note: "제주시에 위치한 상하이버터떡 판매 제과점",
    },
  };

  // Check for exact match first
  let match = matchMap[shop.name];

  // Check for partial match if no exact match
  if (!match) {
    for (const [key, value] of Object.entries(matchMap)) {
      if (shop.name.includes(key) || key.includes(shop.name)) {
        match = value;
        break;
      }
    }
  }

  if (match) {
    if (match.category) {
      const categoryTag = match.category;
      if (!shop.tags.includes(categoryTag)) {
        newTags.push(categoryTag);
      }
    }

    const parts: string[] = [];
    if (match.rating) {
      parts.push(`★ ${match.rating}`);
      if (match.reviewCount) {
        parts[parts.length - 1] += ` (${match.reviewCount}개 리뷰)`;
      }
    }
    if (match.category) {
      parts.push(match.category);
    }
    parts.push(match.note);

    return { description: parts.join(" · "), newTags };
  }

  // Fallback: build from shop's existing tags and region
  return buildFallbackDescription(shop);
}

function buildFallbackDescription(shop: Shop): { description: string; newTags: string[] } {
  const location = getLocationNote(shop);
  const parts: string[] = [];

  // Determine category from tags
  const tagStr = shop.tags.join(", ");

  // Handle specific shops not in the match table
  if (shop.name.startsWith("하츠베이커리")) {
    const branch = shop.name.replace("하츠베이커리 ", "");
    parts.push("베이커리");
    parts.push(`${branch.replace("점", "")}에 위치한 하츠베이커리의 상하이버터떡 판매 지점`);
  } else if (shop.name.startsWith("미구제과")) {
    const branch = shop.name.replace("미구제과 ", "");
    const district = getDistrict(shop.address);
    parts.push("제과점");
    if (branch === "본점") {
      parts.push(`대구 ${district}에 위치한 미구제과 본점, 상하이버터떡 판매`);
    } else if (branch === "동구점") {
      parts.push(`대구 동구에 위치한 상하이버터떡 판매 제과점`);
    } else if (branch === "중앙점") {
      parts.push(`대구 중구 중앙로에 위치한 상하이버터떡 판매 제과점`);
    } else {
      parts.push(`대구 ${district}에 위치한 상하이버터떡 판매 제과점`);
    }
  } else if (shop.name.startsWith("디저트39")) {
    const branch = shop.name.replace("디저트39 ", "");
    parts.push("디저트카페");
    if (branch === "광주상무지구점") {
      parts.push("광주 서구 상무지구에 위치한 상하이버터떡을 판매하는 디저트 프랜차이즈");
    } else if (branch === "전대점") {
      parts.push("광주 북구 전남대 인근의 상하이버터떡을 판매하는 디저트 프랜차이즈");
    } else {
      parts.push(`${branch.replace("점", "")} 인근의 상하이버터떡을 판매하는 디저트 프랜차이즈`);
    }
  } else if (shop.name === "그런느낌") {
    parts.push("카페");
    parts.push("광주 광산구 수완지구에 위치한 상하이버터떡 판매 카페");
  } else if (shop.name === "크림집") {
    parts.push("디저트카페");
    parts.push("광주 광산구에서 상하이버터떡을 포함한 디저트를 판매하는 카페");
  } else if (shop.name === "마미공방") {
    parts.push("베이커리");
    parts.push("대전 서구에 위치한 상하이버터떡 판매 베이커리");
  } else if (shop.name === "조안나카페") {
    parts.push("카페");
    parts.push("시흥 은계동에 위치한 상하이버터떡 판매 카페");
  } else if (shop.name === "휘도르") {
    parts.push("베이커리");
    parts.push("인천 미추홀구 주안동에 위치한 상하이버터떡 판매 베이커리");
  } else if (shop.name === "파밀리아제과점") {
    parts.push("제과점");
    parts.push("부산 사상구에 위치한 상하이버터떡 판매 제과점");
  } else if (shop.name === "모리베이커리") {
    parts.push("베이커리");
    parts.push("대구 수성구에 위치한 상하이버터떡 판매 베이커리");
  } else if (shop.name === "도우트리베이커리카페") {
    parts.push("베이커리카페");
    parts.push("울산 울주군 서생면 해안가에 위치한 상하이버터떡 판매 베이커리 카페");
  } else if (shop.name === "지우제과") {
    parts.push("제과점");
    parts.push("충남 아산 배방읍에 위치한 상하이버터떡 판매 제과점");
  } else {
    // Generic fallback
    if (shop.tags.length > 0) {
      parts.push(shop.tags[0]);
    }
    parts.push(`${location}에서 상하이버터떡을 판매`);
  }

  return { description: parts.join(" · "), newTags: [] };
}

// Process all shops
for (const shop of shops) {
  const { description, newTags } = buildDescription(shop);
  shop.description = description;
  for (const tag of newTags) {
    if (!shop.tags.includes(tag)) {
      shop.tags.push(tag);
    }
  }
}

// Write updated shops
fs.writeFileSync(shopsPath, JSON.stringify(shops, null, 2) + "\n", "utf-8");

console.log("Updated descriptions for all shops:");
for (const shop of shops) {
  console.log(`  ${shop.name}: ${shop.description}`);
  console.log(`    tags: [${shop.tags.join(", ")}]`);
}
console.log(`\nTotal: ${shops.length} shops updated.`);
