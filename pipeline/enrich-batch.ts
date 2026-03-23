/**
 * Batch Google Maps enrichment script.
 * Usage: npx tsx pipeline/enrich-batch.ts --start 0 --end 48 --output pipeline/data/enriched-batch-0.json
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'
import type { RawShop, EnrichedShop } from './lib/types'
import { extractRegion, sleep } from './lib/utils'

const __filename = fileURLToPath(import.meta.url)
const pipelineDir = resolve(dirname(__filename))

// Parse CLI args
const args = process.argv.slice(2)
function getArg(name: string, defaultVal: string): string {
  const idx = args.indexOf(name)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal
}

const startIdx = parseInt(getArg('--start', '0'), 10)
const endIdx = parseInt(getArg('--end', '48'), 10)
const outputFile = getArg('--output', `pipeline/data/enriched-batch-${startIdx}.json`)

const cleanedPath = resolve(pipelineDir, 'data/cleaned-shops.json')
const allShops: RawShop[] = JSON.parse(readFileSync(cleanedPath, 'utf-8'))
const batch = allShops.slice(startIdx, endIdx)

console.log(`[Batch ${startIdx}-${endIdx}] ${batch.length}개 매장 처리 시작`)

async function searchGoogleMaps(
  page: import('playwright').Page,
  shopName: string,
  city: string
): Promise<Partial<EnrichedShop> | null> {
  const query = encodeURIComponent(`${shopName} ${city}`)
  const url = `https://www.google.com/maps/search/${query}`

  try {
    // Use domcontentloaded instead of networkidle (Google Maps never idles)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    // Wait for map or results to appear
    await page.waitForSelector('div[role="main"]', { timeout: 8000 }).catch(() => {})
    await sleep(2000)

    // Click the first result if a list appears
    const firstResult = page.locator('a[href*="/maps/place/"]').first()
    const hasResults = await firstResult.count().catch(() => 0)
    if (hasResults > 0) {
      await firstResult.click()
      await page.waitForSelector('h1.DUwDvf', { timeout: 8000 }).catch(() => {})
      await sleep(1500)
    }

    // Extract name
    const name = await page.$eval(
      'h1.DUwDvf, h1[data-attrid="title"]',
      el => el.textContent?.trim() || ''
    ).catch(() => '')

    // Extract address
    const address = await page.$eval(
      'button[data-item-id="address"] .Io6YTe, [data-tooltip="주소 복사"]',
      el => el.textContent?.trim() || ''
    ).catch(() => '')

    // Extract phone
    const phone = await page.$eval(
      'button[data-item-id^="phone:"] .Io6YTe, [data-tooltip="전화번호 복사"]',
      el => el.textContent?.trim() || ''
    ).catch(() => '')

    // Extract hours
    const hours = await page.$eval(
      '[data-item-id="oh"] .Io6YTe, .o7FIqe .ZDu9vd',
      el => el.textContent?.trim() || ''
    ).catch(() => '')

    // Extract rating
    const rating = await page.$eval(
      'div.F7nice span[aria-hidden="true"]',
      el => el.textContent?.trim() || ''
    ).catch(() => '')

    // Extract review count
    const reviewCount = await page.$eval(
      'div.F7nice span[aria-label*="리뷰"], div.F7nice span[aria-label*="review"]',
      el => {
        const match = el.getAttribute('aria-label')?.match(/[\d,]+/)
        return match ? match[0].replace(/,/g, '') : ''
      }
    ).catch(() => '')

    // Extract category
    const category = await page.$eval(
      'button.DkEaL, span.DkEaL',
      el => el.textContent?.trim() || ''
    ).catch(() => '')

    // Parse coordinates from URL
    const currentUrl = page.url()
    const atMatch = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    const bangMatch = currentUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
    const coords = atMatch
      ? { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) }
      : bangMatch
        ? { lat: parseFloat(bangMatch[1]), lng: parseFloat(bangMatch[2]) }
        : null

    return { name, address, phone, hours, rating, reviewCount, category, lat: coords?.lat ?? null, lng: coords?.lng ?? null }
  } catch (error) {
    console.error(`  Failed: "${shopName}": ${error instanceof Error ? error.message : error}`)
    return null
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()
  const enriched: EnrichedShop[] = []

  for (let i = 0; i < batch.length; i++) {
    const shop = batch[i]
    const globalIdx = startIdx + i + 1
    console.log(`  [${globalIdx}/${allShops.length}] "${shop.name}"`)

    const city = extractRegion(shop.address) || ''
    const mapsData = await searchGoogleMaps(page, shop.name, city)

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
    console.log(`    좌표: ${coord} | 평점: ${mapsData?.rating || '-'}`)

    await sleep(1500)
  }

  await page.close()
  await browser.close()

  const outPath = resolve(pipelineDir, '..', outputFile)
  writeFileSync(outPath, JSON.stringify(enriched, null, 2), 'utf-8')
  console.log(`\n[Batch ${startIdx}-${endIdx}] 완료! ${enriched.length}개 저장 → ${outPath}`)

  const withCoords = enriched.filter(s => s.lat !== null).length
  console.log(`  좌표 있음: ${withCoords}/${enriched.length}`)
}

main().catch(err => {
  console.error(`[Batch ${startIdx}-${endIdx}] 오류:`, err)
  process.exit(1)
})
