import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { chromium } from 'playwright'
import { parseCoordinatesFromUrl } from '../pipeline/lib/google-maps'

const DELAY = 2500

async function main() {
  const dataPath = resolve(import.meta.dirname!, '../pipeline/data/enriched-shops.json')
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'))

  const needCoords = data.filter((s: any) => !s.lat || !s.lng || s.lat < 33 || s.lat > 39 || s.lng < 124.5 || s.lng > 132)
  console.log(`[geocode] ${needCoords.length}개 매장 좌표 검색 시작`)

  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ locale: 'ko-KR' })).newPage()

  let found = 0
  let failed = 0

  for (let i = 0; i < needCoords.length; i++) {
    const shop = needCoords[i]
    const query = shop.address && shop.address.length > 10
      ? shop.address.replace(/KR\s*/g, '').trim()
      : `${shop.name} ${shop.address || ''}`

    console.log(`  [${i + 1}/${needCoords.length}] ${shop.name} → "${query.slice(0, 50)}"`)

    try {
      const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await new Promise(r => setTimeout(r, DELAY))

      // Click first result if list appears
      const first = page.locator('a[href*="/maps/place/"]').first()
      if (await first.count() > 0) {
        await first.click()
        await new Promise(r => setTimeout(r, 3000))
      } else {
        await new Promise(r => setTimeout(r, 1000))
      }

      const coords = parseCoordinatesFromUrl(page.url())
      if (coords && coords.lat > 33 && coords.lat < 39 && coords.lng > 124.5 && coords.lng < 132) {
        shop.lat = coords.lat
        shop.lng = coords.lng
        found++
        console.log(`    ✓ ${coords.lat}, ${coords.lng}`)
      } else {
        failed++
        console.log(`    ✗ 좌표 없음`)
      }
    } catch (e: any) {
      failed++
      console.log(`    ✗ 에러: ${e.message?.slice(0, 60)}`)
    }

    // Save every 20
    if ((i + 1) % 20 === 0) {
      writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8')
      console.log(`    [saved] ${found} found / ${failed} failed`)
    }
  }

  await browser.close()
  writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8')

  console.log('\n' + '='.repeat(50))
  console.log(`[geocode] 완료: ${found}개 찾음, ${failed}개 실패`)
  console.log('='.repeat(50))
}

main().catch(console.error)
