import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { chromium } from 'playwright'
import type { RawShop, EnrichedShop } from './lib/types'
import { searchGoogleMaps } from './lib/google-maps'
import { extractRegion, loadConfig, getDataDir, sleep } from './lib/utils'

const config = loadConfig()
const dataDir = getDataDir()

const cleanedPath = resolve(dataDir, 'cleaned-shops.json')
const cleanedShops: RawShop[] = JSON.parse(readFileSync(cleanedPath, 'utf-8'))

async function main() {
  console.log('[Stage 4] Google Maps 데이터 보강')
  console.log(`  입력: ${cleanedShops.length}개 매장`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })

  const enrichedShops: EnrichedShop[] = []
  const page = await context.newPage()

  try {
    for (let i = 0; i < cleanedShops.length; i++) {
      const shop = cleanedShops[i]
      console.log(`  [${i + 1}/${cleanedShops.length}] "${shop.name}"`)

      // Determine city from address for search context
      const city = extractRegion(shop.address) || ''

      const mapsData = await searchGoogleMaps(page, shop.name, city, config.googleMapsDelayMs)

      const enriched: EnrichedShop = {
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

      enrichedShops.push(enriched)
      console.log(`    주소: ${enriched.address || '(없음)'}`)
      console.log(`    좌표: ${enriched.lat}, ${enriched.lng}`)
      console.log(`    평점: ${enriched.rating || '(없음)'}`)

      await sleep(config.googleMapsDelayMs)
    }
  } finally {
    await page.close()
    await browser.close()
  }

  const outputPath = resolve(dataDir, 'enriched-shops.json')
  writeFileSync(outputPath, JSON.stringify(enrichedShops, null, 2), 'utf-8')
  console.log(`  저장: ${outputPath}`)
  console.log('[Stage 4] 완료\n')
}

main().catch(err => {
  console.error('[Stage 4] 오류:', err)
  process.exit(1)
})
