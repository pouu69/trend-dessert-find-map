import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { chromium } from 'playwright'
import { searchGoogleMaps } from '../pipeline/lib/google-maps'
import { extractRegion, sleep } from '../pipeline/lib/utils'
import type { EnrichedShop } from '../pipeline/lib/types'

const SCRIPTS_DIR = resolve(import.meta.dirname!)
const DELAY_MS = 2000
const BATCH_SIZE = 15

// Load and merge all butterttuk results
function loadAllResults() {
  const files = [
    resolve(SCRIPTS_DIR, 'naver-place-butterttuk-results.json'),
    resolve(SCRIPTS_DIR, 'naver-butterttuk-bundang-results.json'),
  ]

  const all: { name: string; address: string; phone: string; hours: string; category: string; query: string; source: string }[] = []
  const seenNames = new Set<string>()

  for (const file of files) {
    if (!existsSync(file)) continue
    const data = JSON.parse(readFileSync(file, 'utf-8'))
    for (const item of data) {
      const key = item.name?.trim().toLowerCase()
      if (!key || key === '?') continue
      if (seenNames.has(key)) continue
      seenNames.add(key)
      all.push(item)
    }
  }

  return all
}

async function main() {
  const shops = loadAllResults()
  console.log(`[enrich] 총 ${shops.length}개 매장 정제 시작`)

  // Check for already-enriched output to resume
  const outPath = resolve(SCRIPTS_DIR, 'butterttuk-enriched.json')
  const enriched: EnrichedShop[] = existsSync(outPath)
    ? JSON.parse(readFileSync(outPath, 'utf-8'))
    : []
  const doneNames = new Set(enriched.map(s => s.name.trim().toLowerCase()))
  const remaining = shops.filter(s => !doneNames.has(s.name.trim().toLowerCase()))

  if (remaining.length === 0) {
    console.log('[enrich] 모든 매장이 이미 정제되었습니다.')
    return
  }

  console.log(`  이미 완료: ${enriched.length}개, 남은: ${remaining.length}개`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  try {
    for (let i = 0; i < remaining.length; i++) {
      const shop = remaining[i]
      const city = extractRegion(shop.address) || ''
      console.log(`  [${enriched.length + 1}/${shops.length}] "${shop.name}" (${city})`)

      const mapsData = await searchGoogleMaps(page, shop.name, city, DELAY_MS)

      const result: EnrichedShop = {
        name: mapsData?.name || shop.name,
        address: mapsData?.address || shop.address,
        phone: mapsData?.phone || shop.phone,
        hours: mapsData?.hours || shop.hours,
        category: mapsData?.category || shop.category,
        rating: mapsData?.rating || '',
        reviewCount: mapsData?.reviewCount || '',
        lat: mapsData?.lat ?? null,
        lng: mapsData?.lng ?? null,
        description: '',
        source: shop.source,
      }

      enriched.push(result)
      console.log(`    -> ${result.address || '(no addr)'} | ${result.lat},${result.lng} | ★${result.rating || '-'}`)

      // Save every BATCH_SIZE items for resume support
      if ((enriched.length) % BATCH_SIZE === 0) {
        writeFileSync(outPath, JSON.stringify(enriched, null, 2), 'utf-8')
        console.log(`    [saved] ${enriched.length}개 저장됨`)
      }

      await sleep(DELAY_MS)
    }
  } finally {
    // Always save on exit
    writeFileSync(outPath, JSON.stringify(enriched, null, 2), 'utf-8')
    await page.close()
    await browser.close()
  }

  // Summary
  const withCoords = enriched.filter(s => s.lat !== null && s.lng !== null)
  const withRating = enriched.filter(s => s.rating)
  console.log('\n' + '='.repeat(60))
  console.log('[enrich] SUMMARY')
  console.log(`  총 매장: ${enriched.length}개`)
  console.log(`  좌표 있음: ${withCoords.length}개`)
  console.log(`  평점 있음: ${withRating.length}개`)
  console.log(`  Output: ${outPath}`)
  console.log('='.repeat(60))
}

main().catch(console.error)
