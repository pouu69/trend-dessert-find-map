/**
 * Retry enrichment for shops missing coordinates.
 * Uses shop name + full address for more precise Google Maps search.
 * Usage: npx tsx pipeline/enrich-retry.ts --start 0 --end 29 --output pipeline/data/retry-batch-0.json
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'
import type { EnrichedShop } from './lib/types'
import { sleep } from './lib/utils'

const __filename = fileURLToPath(import.meta.url)
const pipelineDir = resolve(dirname(__filename))

const args = process.argv.slice(2)
function getArg(name: string, defaultVal: string): string {
  const idx = args.indexOf(name)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal
}

const startIdx = parseInt(getArg('--start', '0'), 10)
const endIdx = parseInt(getArg('--end', '29'), 10)
const outputFile = getArg('--output', `pipeline/data/retry-batch-${startIdx}.json`)

const missingData = JSON.parse(readFileSync(resolve(pipelineDir, 'data/missing-coords.json'), 'utf-8'))
const allMissing: EnrichedShop[] = missingData.shops
const allIndices: number[] = missingData.indices
const batch = allMissing.slice(startIdx, endIdx)
const batchIndices = allIndices.slice(startIdx, endIdx)

console.log(`[Retry ${startIdx}-${endIdx}] ${batch.length}개 매장 재시도`)

async function searchWithAddress(
  page: import('playwright').Page,
  shopName: string,
  address: string
): Promise<{ lat: number; lng: number } | null> {
  // Strategy 1: Search by name + address together
  const queries = [
    `${shopName} ${address.split(/\s+/).slice(0, 3).join(' ')}`,
    address.replace(/\n.*/g, '').trim(),
  ]

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

      // Parse coordinates from URL
      const currentUrl = page.url()
      const atMatch = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
      const bangMatch = currentUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
      const coords = atMatch
        ? { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) }
        : bangMatch
          ? { lat: parseFloat(bangMatch[1]), lng: parseFloat(bangMatch[2]) }
          : null

      if (coords) return coords
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
  const results: Array<{ index: number; lat: number | null; lng: number | null }> = []

  for (let i = 0; i < batch.length; i++) {
    const shop = batch[i]
    const globalIdx = batchIndices[i]
    console.log(`  [${startIdx + i + 1}/${allMissing.length}] "${shop.name}" (idx:${globalIdx})`)

    const coords = await searchWithAddress(page, shop.name, shop.address)
    results.push({ index: globalIdx, lat: coords?.lat ?? null, lng: coords?.lng ?? null })

    const coordStr = coords ? `${coords.lat}, ${coords.lng}` : 'null'
    console.log(`    좌표: ${coordStr}`)

    await sleep(1500)
  }

  await page.close()
  await browser.close()

  const outPath = resolve(pipelineDir, '..', outputFile)
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8')

  const found = results.filter(r => r.lat !== null).length
  console.log(`\n[Retry ${startIdx}-${endIdx}] 완료! 좌표 확보: ${found}/${batch.length}`)
}

main().catch(err => {
  console.error(`[Retry ${startIdx}-${endIdx}] 오류:`, err)
  process.exit(1)
})
