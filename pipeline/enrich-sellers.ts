/**
 * Enrich filtered sellers with Google Maps coordinates.
 * Usage: npx tsx pipeline/enrich-sellers.ts --start 0 --end 23 --output pipeline/data/sellers-enriched-0.json
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'
import type { RawShop, EnrichedShop } from './lib/types'
import { extractRegion, sleep } from './lib/utils'

const __filename = fileURLToPath(import.meta.url)
const pipelineDir = resolve(dirname(__filename))

const args = process.argv.slice(2)
function getArg(name: string, defaultVal: string): string {
  const idx = args.indexOf(name)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal
}

const startIdx = parseInt(getArg('--start', '0'), 10)
const endIdx = parseInt(getArg('--end', '23'), 10)
const outputFile = getArg('--output', `pipeline/data/sellers-enriched-${startIdx}.json`)

const allShops: RawShop[] = JSON.parse(readFileSync(resolve(pipelineDir, 'data/sellers-to-enrich.json'), 'utf-8'))
const batch = allShops.slice(startIdx, endIdx)

console.log(`[Sellers ${startIdx}-${endIdx}] ${batch.length}개 매장 좌표 수집`)

async function searchGoogleMaps(
  page: import('playwright').Page,
  shopName: string,
  address: string
): Promise<Partial<EnrichedShop> | null> {
  // Try multiple search strategies
  const queries = [
    `${shopName}`,
    `${shopName} ${address.split(/\s+/).slice(0, 2).join(' ')}`,
    address.length > 10 ? address.replace(/\n.*/g, '').trim() : '',
  ].filter(Boolean)

  for (const q of queries) {
    const query = encodeURIComponent(q)
    const url = `https://www.google.com/maps/search/${query}`

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForSelector('div[role="main"]', { timeout: 8000 }).catch(() => {})
      await sleep(2500)

      // Click first result if list
      const firstResult = page.locator('a[href*="/maps/place/"]').first()
      const hasResults = await firstResult.count().catch(() => 0)
      if (hasResults > 0) {
        await firstResult.click()
        await page.waitForSelector('h1.DUwDvf', { timeout: 8000 }).catch(() => {})
        await sleep(2000)
      }

      // Extract info
      const name = await page.$eval('h1.DUwDvf', el => el.textContent?.trim() || '').catch(() => '')
      const addr = await page.$eval('button[data-item-id="address"] .Io6YTe', el => el.textContent?.trim() || '').catch(() => '')
      const phone = await page.$eval('button[data-item-id^="phone:"] .Io6YTe', el => el.textContent?.trim() || '').catch(() => '')
      const hours = await page.$eval('[data-item-id="oh"] .Io6YTe', el => el.textContent?.trim() || '').catch(() => '')
      const rating = await page.$eval('div.F7nice span[aria-hidden="true"]', el => el.textContent?.trim() || '').catch(() => '')
      const reviewCount = await page.$eval('div.F7nice span[aria-label*="리뷰"], div.F7nice span[aria-label*="review"]', el => {
        const match = el.getAttribute('aria-label')?.match(/[\d,]+/)
        return match ? match[0].replace(/,/g, '') : ''
      }).catch(() => '')
      const category = await page.$eval('button.DkEaL, span.DkEaL', el => el.textContent?.trim() || '').catch(() => '')

      // Parse coordinates
      const currentUrl = page.url()
      const atMatch = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
      const bangMatch = currentUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
      const coords = atMatch
        ? { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) }
        : bangMatch
          ? { lat: parseFloat(bangMatch[1]), lng: parseFloat(bangMatch[2]) }
          : null

      if (coords) {
        return { name: name || undefined, address: addr || undefined, phone, hours, rating, reviewCount, category, lat: coords.lat, lng: coords.lng }
      }
    } catch {
      // Try next query
    }
  }
  return null
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()
  const enriched: EnrichedShop[] = []

  for (let i = 0; i < batch.length; i++) {
    const shop = batch[i]
    console.log(`  [${startIdx + i + 1}/${allShops.length}] "${shop.name}"`)

    const mapsData = await searchGoogleMaps(page, shop.name, shop.address)

    enriched.push({
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
    })

    const coord = mapsData?.lat ? `${mapsData.lat}, ${mapsData.lng}` : 'null'
    console.log(`    좌표: ${coord}`)

    await sleep(1500)
  }

  await page.close()
  await browser.close()

  const outPath = resolve(pipelineDir, '..', outputFile)
  writeFileSync(outPath, JSON.stringify(enriched, null, 2), 'utf-8')

  const withCoords = enriched.filter(s => s.lat !== null).length
  console.log(`\n[Sellers ${startIdx}-${endIdx}] 완료! 좌표 확보: ${withCoords}/${batch.length}`)
}

main().catch(err => {
  console.error(`[Sellers ${startIdx}-${endIdx}] 오류:`, err)
  process.exit(1)
})
