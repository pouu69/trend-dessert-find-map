import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { crawlNaver } from './crawl-naver'
import { crawlKakao } from './crawl-kakao'
import { geocodeAll } from './geocode'
import { mergeShops } from './merge-data'
import type { Shop } from '../types/shop'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const KEYWORD = '상하이버터떡'
const OUTPUT_PATH = resolve(__dirname, '../data/shops.json')

async function main() {
  console.log(`\n🧈 상하이버터떡 데이터 수집 시작\n`)
  console.log(`키워드: "${KEYWORD}"`)
  console.log(`출력: ${OUTPUT_PATH}\n`)

  // Load existing data
  let existingShops: Shop[] = []
  if (existsSync(OUTPUT_PATH)) {
    try {
      existingShops = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'))
      console.log(`기존 데이터: ${existingShops.length}개 가게\n`)
    } catch {
      console.warn('기존 shops.json 파싱 실패, 새로 생성합니다.\n')
    }
  }

  // Crawl from sources
  const [naverShops, kakaoShops] = await Promise.all([
    crawlNaver(KEYWORD).catch(e => {
      console.error('[naver] 전체 크롤링 실패:', e)
      return []
    }),
    crawlKakao(KEYWORD).catch(e => {
      console.error('[kakao] 전체 크롤링 실패:', e)
      return []
    }),
  ])

  if (naverShops.length === 0 && kakaoShops.length === 0) {
    console.error('\n❌ 수집된 데이터가 없습니다. 기존 데이터를 유지합니다.')
    process.exit(1)
  }

  console.log(`\n수집 결과: 네이버 ${naverShops.length}개, 카카오 ${kakaoShops.length}개`)

  // Collect unique addresses for geocoding
  const allRawShops = [...naverShops, ...kakaoShops]
  const uniqueAddresses = [...new Set(allRawShops.map(s => s.address).filter(Boolean))]
  console.log(`\n📍 ${uniqueAddresses.length}개 주소 지오코딩 중... (주소당 ~1초)`)

  const geoResults = await geocodeAll(uniqueAddresses)
  const geoSuccess = [...geoResults.values()].filter(v => v !== null).length
  console.log(`지오코딩 완료: ${geoSuccess}/${uniqueAddresses.length} 성공`)

  // Merge data
  const mergedShops = mergeShops(naverShops, kakaoShops, geoResults, existingShops)

  // Write output
  const outputDir = dirname(OUTPUT_PATH)
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(mergedShops, null, 2), 'utf-8')
  console.log(`\n✅ 완료! ${mergedShops.length}개 가게 저장 → ${OUTPUT_PATH}\n`)
}

main().catch(e => {
  console.error('치명적 오류:', e)
  process.exit(1)
})
