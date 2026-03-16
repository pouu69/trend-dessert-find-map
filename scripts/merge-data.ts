import type { RawShop } from './crawl-naver'
import type { Shop } from '../src/types/shop'

function normalizeName(name: string): string {
  return name.replace(/[\s\-·.,()]/g, '').toLowerCase()
}

function extractRegion(address: string): string {
  const parts = address.split(/\s+/)
  if (parts.length === 0) return '기타'

  const first = parts[0]
  const regionMap: Record<string, string> = {
    서울특별시: '서울', 서울시: '서울', 서울: '서울',
    부산광역시: '부산', 부산시: '부산', 부산: '부산',
    대구광역시: '대구', 대구시: '대구', 대구: '대구',
    인천광역시: '인천', 인천시: '인천', 인천: '인천',
    광주광역시: '광주', 광주시: '광주', 광주: '광주',
    대전광역시: '대전', 대전시: '대전', 대전: '대전',
    울산광역시: '울산', 울산시: '울산', 울산: '울산',
    세종특별자치시: '세종', 세종시: '세종', 세종: '세종',
    경기도: '경기', 경기: '경기',
    강원특별자치도: '강원', 강원도: '강원', 강원: '강원',
    충청북도: '충북', 충북: '충북',
    충청남도: '충남', 충남: '충남',
    전북특별자치도: '전북', 전라북도: '전북', 전북: '전북',
    전라남도: '전남', 전남: '전남',
    경상북도: '경북', 경북: '경북',
    경상남도: '경남', 경남: '경남',
    제주특별자치도: '제주', 제주도: '제주', 제주: '제주',
  }

  return regionMap[first] || first
}

function extractDistrict(address: string): string {
  const parts = address.split(/\s+/)
  return parts.slice(0, 3).join(' ')
}

function isDuplicate(a: RawShop, b: RawShop): boolean {
  const nameMatch = normalizeName(a.name) === normalizeName(b.name)
  const districtMatch = extractDistrict(a.address) === extractDistrict(b.address)
  return nameMatch && districtMatch
}

export function mergeShops(
  naverShops: RawShop[],
  kakaoShops: RawShop[],
  geoResults: Map<string, { lat: number; lng: number } | null>,
  existingShops: Shop[] = [],
): Shop[] {
  // Start with naver shops (priority)
  const merged: RawShop[] = [...naverShops]

  // Add kakao shops that are not duplicates
  for (const kakaoShop of kakaoShops) {
    const isDup = merged.some(existing => isDuplicate(existing, kakaoShop))
    if (!isDup) {
      merged.push(kakaoShop)
    } else {
      // Supplement missing fields from kakao
      const match = merged.find(existing => isDuplicate(existing, kakaoShop))
      if (match) {
        if (!match.phone && kakaoShop.phone) match.phone = kakaoShop.phone
        if (!match.hours && kakaoShop.hours) match.hours = kakaoShop.hours
      }
    }
  }

  // Convert to Shop format
  const newShops: Shop[] = merged.map((raw, i) => {
    const geo = geoResults.get(raw.address) ?? null
    const id = `shop-${String(existingShops.length + i + 1).padStart(3, '0')}`

    // Note: closedDays, priceRange, description are not available from crawlers.
    // These fields default to empty and can be manually enriched later.
    return {
      id,
      name: raw.name,
      address: raw.address,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      phone: raw.phone,
      hours: raw.hours,
      closedDays: [],
      priceRange: '',
      tags: raw.category ? [raw.category] : [],
      description: '',
      region: extractRegion(raw.address),
    }
  })

  // Merge with existing, skip duplicates
  const result = [...existingShops]
  for (const newShop of newShops) {
    const existingDup = result.some(
      existing =>
        normalizeName(existing.name) === normalizeName(newShop.name) &&
        extractDistrict(existing.address) === extractDistrict(newShop.address)
    )
    if (!existingDup) {
      result.push(newShop)
    }
  }

  return result
}
