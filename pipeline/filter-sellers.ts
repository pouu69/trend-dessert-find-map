import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { RawShop } from './lib/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dataDir = resolve(__dirname, 'data')
const inputPath = resolve(dataDir, 'cleaned-shops.json')
const outputPath = resolve(dataDir, 'filtered-sellers.json')

const shops: RawShop[] = JSON.parse(readFileSync(inputPath, 'utf-8'))
console.log(`[filter-sellers] 입력: ${shops.length}개 매장\n`)

// Whitelist: patterns strongly indicating a retail snack seller
const WHITELIST_PATTERNS = [
  '마트', '슈퍼', '백화점', '제과', '베이커리', '빵', '편의점',
  'CU', 'GS25', '세븐일레븐', '7eleven', '7-eleven',
  '이마트', '롯데마트', '홈플러스', '트레이더스', '코스트코', '하나로마트',
  'GS더프레시', '롯데슈퍼', '농축산마트', '식자재마트',
  '이마트24', '미니스톱',
  '디저트', '떡', '과자', '양과자', '케이크',
  '다이소', '올리브영',
]

// Blacklist: patterns clearly indicating a non-seller
const BLACKLIST_PATTERNS = [
  // 음식점
  '치킨', '통닭', '갈비', '곱창', '족발', '삼겹', '삼겹살',
  '해장국', '냉면', '돈까스', '돈가스', '해산물', '횟집', '수산',
  '샤브', '마라탕', '라멘', '우동', '스시', '초밥', '순대',
  '설렁탕', '국밥', '뼈해장', '탕', '막창', '오돌뼈',
  '고기', '소금구이', '구이', '꼬치', '튀김',
  '중식당', '한식당', '일식', '중식', '양식',
  '굴사냥', '수산참치',
  // 카페/음료
  '커피', '카페', '라운지', '바',
  // 패스트푸드/프랜차이즈 음식점
  '롯데리아', '맥도날드', '버거킹', '버거', '피자', '치즈버거',
  '배스킨', '아이스크림', '요거트',
  // 비관련 업종
  '미용', '헤어', '네일', '병원', '의원', '약국', '한의원', '치과',
  '학교', '도서관', '아파트', '주민센터', '구청',
  '스파', '모텔', '호텔', '리조트', '펜션',
  '부동산', '세탁', '주유', '렌터카', '담배',
  '이케아', '전자랜드', '양장',
  // 제품명 (가게가 아닌 상품 자체)
  '치즈칩',
]

// Generic/broken name patterns to always exclude
const GENERIC_NAME_PATTERNS = [
  /^[가-힣]{1,2}$/,          // 1~2 character Korean names
  /^[a-zA-Z]{1,3}$/,         // 1~3 char English
  /^[가-힣]+광역시$/,         // just a city name
  /^[가-힣]+특별시$/,
  /^[가-힣]+도$/,
  /^[가-힣]+시$/,
  /^[가-힣]+구$/,
  /^[가-힣]+점$/,             // just "XXX점" with no brand (e.g. "잠실점")
]

function isGenericName(name: string): boolean {
  const trimmed = name.trim()
  return GENERIC_NAME_PATTERNS.some(re => re.test(trimmed))
}

function classifyShop(name: string): 'keep' | 'remove' | 'unknown' {
  const n = name.trim()

  if (isGenericName(n)) return 'remove'

  // Check blacklist first (more specific)
  for (const pat of BLACKLIST_PATTERNS) {
    if (n.includes(pat)) return 'remove'
  }

  // Check whitelist
  for (const pat of WHITELIST_PATTERNS) {
    if (n.includes(pat)) return 'keep'
  }

  return 'unknown'
}

// Categorise kept shops
function getCategory(name: string): string {
  const n = name.trim()
  if (/이마트|롯데마트|홈플러스|트레이더스|코스트코|하나로마트|메가마트|누리마트|더마트|마트킹|텃밭/.test(n)) return '대형마트'
  if (/GS더프레시|롯데슈퍼|농축산마트|식자재마트|푸드엔|슈퍼/.test(n)) return '슈퍼/식자재마트'
  if (/CU|GS25|세븐일레븐|이마트24|미니스톱|편의점/.test(n)) return '편의점'
  if (/롯데백화점|신세계백화점|현대백화점|갤러리아|백화점/.test(n)) return '백화점'
  if (/제과|베이커리|빵|양과자|떡|과자|케이크|디저트/.test(n)) return '제과/베이커리/디저트'
  if (/다이소/.test(n)) return '잡화점'
  if (/올리브영/.test(n)) return '드럭스토어'
  if (/마트/.test(n)) return '마트(기타)'
  return '기타'
}

const kept: RawShop[] = []
const removed: RawShop[] = []
const unknown: RawShop[] = []

for (const shop of shops) {
  const result = classifyShop(shop.name)
  if (result === 'keep') {
    kept.push(shop)
  } else if (result === 'remove') {
    removed.push(shop)
  } else {
    unknown.push(shop)
  }
}

// Print unknown for manual inspection, then include them as removed by default
// (conservative: only keep explicitly whitelisted)
console.log(`=== 분류 결과 ===`)
console.log(`  유지 (whitelist 매칭): ${kept.length}개`)
console.log(`  제거 (blacklist 매칭 또는 generic): ${removed.length}개`)
console.log(`  미분류 (수동 확인 필요): ${unknown.length}개\n`)

if (unknown.length > 0) {
  console.log('--- 미분류 매장 목록 ---')
  unknown.forEach(s => console.log(`  [미분류] ${s.name}  |  ${s.address.split('\n')[0]}`))
  console.log()
}

// Category breakdown for kept shops
const categoryCount: Record<string, number> = {}
for (const shop of kept) {
  const cat = getCategory(shop.name)
  categoryCount[cat] = (categoryCount[cat] ?? 0) + 1
}

console.log('--- 유지된 매장 카테고리 분포 ---')
for (const [cat, count] of Object.entries(categoryCount).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat}: ${count}개`)
}
console.log()

console.log('--- 유지된 매장 전체 목록 ---')
kept.forEach((shop, i) => {
  const cat = getCategory(shop.name)
  console.log(`  ${String(i + 1).padStart(3)}. [${cat}] ${shop.name}  |  ${shop.address.split('\n')[0]}`)
})

writeFileSync(outputPath, JSON.stringify(kept, null, 2), 'utf-8')
console.log(`\n[filter-sellers] 저장: ${outputPath}`)
console.log(`[filter-sellers] 완료: ${kept.length}개 판매점 추출 (${shops.length}개 중)`)
