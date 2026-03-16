import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface ShopResult {
  name: string
  searchQuery: string
  address: string
  phone: string
  hours: string
  rating: string
  lat: number | null
  lng: number | null
}

const QUERIES = [
  '미구제과 대구 달서구',
  '미구제과 대구 수성구 범어',
  '미구제과 대구 봉산',
  '미구제과 대구 중앙로',
  '미구제과 대구 동구',
  '스칼렛베이커리 분당 상하이버터떡',
  '김덕규베이커리 김해 상하이버터떡',
]

function extractCoordsFromUrl(url: string): { lat: number | null; lng: number | null } {
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) }
  }
  const match2 = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (match2) {
    return { lat: parseFloat(match2[1]), lng: parseFloat(match2[2]) }
  }
  return { lat: null, lng: null }
}

async function main() {
  const results: ShopResult[] = []
  const failed: string[] = []

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    geolocation: { latitude: 37.5665, longitude: 126.978 },
    permissions: ['geolocation'],
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })

  const page = await context.newPage()

  // Dismiss any initial Google consent
  await page.goto('https://www.google.com/maps', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  try {
    const consentBtn = page.locator('button:has-text("Accept all"), button:has-text("모두 수락"), form[action*="consent"] button')
    if (await consentBtn.first().isVisible({ timeout: 3000 })) {
      await consentBtn.first().click()
      await page.waitForTimeout(1000)
    }
  } catch {
    // No consent dialog
  }

  for (let i = 0; i < QUERIES.length; i++) {
    const query = QUERIES[i]
    console.log(`[${i + 1}/${QUERIES.length}] Searching: ${query}`)

    try {
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(3000)

      // Check for CAPTCHA
      const captcha = await page.locator('#captcha-form, .g-recaptcha, iframe[src*="recaptcha"]').count()
      if (captcha > 0) {
        console.log('CAPTCHA detected! Stopping.')
        break
      }

      // Check if we landed directly on a place page or on search results
      const currentUrl = page.url()
      const isDirectPlace = currentUrl.includes('/place/')

      if (!isDirectPlace) {
        // Click the first result in the list
        let clicked = false
        for (const selector of [
          'div[role="feed"] > div > div > a',
          'a[href*="/maps/place/"]',
          '.Nv2PK',
        ]) {
          try {
            const item = page.locator(selector).first()
            await item.waitFor({ timeout: 5000 })
            await item.click()
            await page.waitForTimeout(3000)
            clicked = true
            break
          } catch {
            continue
          }
        }
        if (!clicked) {
          console.log(`  -> No results found for: ${query}`)
          failed.push(query)
          await page.waitForTimeout(1000)
          continue
        }
      }

      // Wait for detail panel to fully load
      await page.waitForTimeout(2000)

      // Wait for the place URL to stabilize (should contain /place/)
      try {
        await page.waitForURL(/\/place\//, { timeout: 5000 })
      } catch {
        // May already be on place page
      }
      await page.waitForTimeout(1000)

      // Extract name - try multiple approaches, skip generic page titles
      let name = ''
      try {
        // First try the place-specific heading
        const h1Text = await page.locator('h1').first().textContent({ timeout: 5000 }) ?? ''
        const trimmed = h1Text.trim()
        // Filter out generic titles
        if (trimmed && trimmed !== '검색 결과' && trimmed !== 'Google 지도' && trimmed.length > 0) {
          name = trimmed
        }
      } catch {
        // ignore
      }
      if (!name) {
        try {
          name = await page.locator('.DUwDvf').first().textContent({ timeout: 3000 }) ?? ''
          name = name.trim()
        } catch {
          // ignore
        }
      }
      if (!name) {
        // Try aria snapshot approach: look for the heading in the detail panel
        try {
          const heading = page.locator('[role="main"] h1, [role="main"] h2').first()
          name = await heading.textContent({ timeout: 3000 }) ?? ''
          name = name.trim()
          if (name === '검색 결과') name = ''
        } catch {
          // ignore
        }
      }

      if (!name) {
        console.log(`  -> Could not extract name for: ${query}`)
        failed.push(query)
        await page.waitForTimeout(1000)
        continue
      }

      // Extract address - look for aria-label with "주소:" prefix
      let address = ''
      try {
        const addrBtn = page.locator('button[data-item-id="address"]').first()
        const ariaLabel = await addrBtn.getAttribute('aria-label', { timeout: 3000 }) ?? ''
        address = ariaLabel.replace(/^주소:\s*/, '').trim()
      } catch {
        // ignore
      }
      if (!address) {
        try {
          const addrBtn = page.locator('button[aria-label*="주소"]').first()
          const ariaLabel = await addrBtn.getAttribute('aria-label', { timeout: 3000 }) ?? ''
          address = ariaLabel.replace(/^주소:\s*/, '').trim()
        } catch {
          // ignore
        }
      }

      // Extract phone - specifically data-item-id starting with "phone:tel:"
      let phone = ''
      try {
        const phoneBtn = page.locator('button[data-item-id^="phone:tel:"]').first()
        const ariaLabel = await phoneBtn.getAttribute('aria-label', { timeout: 3000 }) ?? ''
        phone = ariaLabel.replace(/^전화번호:\s*/, '').replace(/^전화:\s*/, '').trim()
      } catch {
        // ignore
      }
      if (!phone) {
        try {
          // Try broader search but exclude "휴대전화로 보내기"
          const phoneBtns = page.locator('button[aria-label*="전화"]')
          const count = await phoneBtns.count()
          for (let j = 0; j < count; j++) {
            const label = await phoneBtns.nth(j).getAttribute('aria-label') ?? ''
            if (label.includes('휴대전화로') || label.includes('보내기')) continue
            if (/\d{2,}/.test(label)) {
              phone = label.replace(/^전화번호:\s*/, '').replace(/^전화:\s*/, '').trim()
              break
            }
          }
        } catch {
          // ignore
        }
      }

      // Extract hours
      let hours = ''
      try {
        const hoursEl = page.locator('[data-item-id="oh"]').first()
        hours = await hoursEl.getAttribute('aria-label', { timeout: 3000 }) ?? ''
        if (!hours) {
          hours = await hoursEl.textContent({ timeout: 3000 }) ?? ''
        }
        // Clean up hours - remove trailing "영업시간 복사" etc
        hours = hours.replace(/,?\s*영업시간 복사/, '').trim()
      } catch {
        try {
          const hoursBtn = page.locator('button[aria-label*="시간"]').first()
          hours = await hoursBtn.getAttribute('aria-label', { timeout: 3000 }) ?? ''
          hours = hours.replace(/,?\s*영업시간 복사/, '').trim()
        } catch {
          hours = ''
        }
      }

      // Extract rating
      let rating = ''
      try {
        const ratingEl = page.locator('.MW4etd').first()
        rating = await ratingEl.textContent({ timeout: 3000 }) ?? ''
        rating = rating.trim()
      } catch {
        try {
          const ratingEl = page.locator('.F7nice span[aria-hidden="true"]').first()
          rating = await ratingEl.textContent({ timeout: 3000 }) ?? ''
          rating = rating.trim()
        } catch {
          rating = ''
        }
      }

      // Extract coordinates from URL
      const finalUrl = page.url()
      const { lat, lng } = extractCoordsFromUrl(finalUrl)

      const result: ShopResult = {
        name,
        searchQuery: query,
        address,
        phone,
        hours,
        rating,
        lat,
        lng,
      }

      results.push(result)
      console.log(`  -> Found: ${name} | ${address} | phone:${phone} | rating:${rating} | coords:${lat},${lng}`)
    } catch (err) {
      console.log(`  -> Error for ${query}: ${err instanceof Error ? err.message : err}`)
      failed.push(query)
    }

    // Wait between searches
    if (i < QUERIES.length - 1) {
      await page.waitForTimeout(2000)
    }
  }

  await browser.close()

  // Write results
  const outputPath = path.join(__dirname, 'gmap-batch3-results.json')
  writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8')

  console.log('\n' + '='.repeat(60))
  console.log(`Results written to: ${outputPath}`)
  console.log(`Total searched: ${QUERIES.length}`)
  console.log(`Successfully found: ${results.length}`)
  console.log(`Failed/skipped: ${failed.length}`)
  if (failed.length > 0) {
    console.log(`Failed shops: ${failed.join(', ')}`)
  }
  console.log('='.repeat(60))

  // Print results
  console.log('\n' + JSON.stringify(results, null, 2))
}

main().catch(console.error)
