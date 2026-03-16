import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface ShopResult {
  name: string
  address: string
  phone: string
  hours: string
  rating: string
  lat: number | null
  lng: number | null
  searchQuery: string
}

const QUERIES = [
  '달리당 수원 창룡대로',
  '수아카롱 본점 수원 영통',
  '코드91 카페 강화도',
  '위치앙베이커리 분당',
  '스칼렛베이커리 분당',
  '디저트릭 인천 부평',
  '휘도르베이커리카페 인천 미추홀',
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

  // Initial Maps load + dismiss consent
  await page.goto('https://www.google.com/maps', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

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
    console.log(`\n[${i + 1}/${QUERIES.length}] Searching: ${query}`)

    try {
      // Navigate to search URL
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(4000)

      // Check for CAPTCHA
      const captcha = await page.locator('#captcha-form, .g-recaptcha, iframe[src*="recaptcha"]').count()
      if (captcha > 0) {
        console.log('CAPTCHA detected! Stopping.')
        break
      }

      // Log current URL to understand state
      let currentUrl = page.url()
      console.log(`  URL: ${currentUrl}`)

      // Check if we're on a place page
      let isDirectPlace = currentUrl.includes('/place/')

      if (!isDirectPlace) {
        // Try clicking first result in the list
        // Google Maps search results have various structures
        let clicked = false

        // Try multiple selectors for search result items
        const selectors = [
          'div[role="feed"] a[href*="/maps/place/"]',
          'a[href*="/maps/place/"]',
          'div.Nv2PK a',
          '[data-result-index="1"] a',
        ]

        for (const sel of selectors) {
          try {
            const el = page.locator(sel).first()
            if (await el.isVisible({ timeout: 3000 })) {
              await el.click()
              await page.waitForTimeout(4000)
              clicked = true
              break
            }
          } catch {
            continue
          }
        }

        if (!clicked) {
          console.log(`  -> No clickable results found for: ${query}`)
          // Debug: log page title and some content
          const title = await page.title()
          console.log(`  -> Page title: ${title}`)
          failed.push(query)
          await page.waitForTimeout(1000)
          continue
        }

        currentUrl = page.url()
        isDirectPlace = currentUrl.includes('/place/')
      }

      await page.waitForTimeout(2000)

      // Extract name - specifically from the place info panel h1
      let name = ''
      try {
        // The place name h1 is inside the place info panel
        const h1Elements = page.locator('h1')
        const count = await h1Elements.count()
        for (let j = 0; j < count; j++) {
          const text = (await h1Elements.nth(j).textContent({ timeout: 2000 }))?.trim() ?? ''
          // Skip generic headings
          if (text && text !== '검색 결과' && text !== 'Google 지도' && text.length > 0) {
            name = text
            break
          }
        }
      } catch {
        name = ''
      }

      if (!name) {
        console.log(`  -> Could not extract name for: ${query}`)
        failed.push(query)
        await page.waitForTimeout(1000)
        continue
      }

      // Extract address - look for data-item-id="address" or aria-label with 주소
      let address = ''
      try {
        const addrBtn = page.locator('button[data-item-id="address"]').first()
        const ariaLabel = await addrBtn.getAttribute('aria-label', { timeout: 3000 })
        if (ariaLabel) {
          address = ariaLabel.replace(/^주소:\s*/, '').trim()
        }
      } catch {
        // no-op
      }
      if (!address) {
        try {
          const addrBtn = page.locator('button[aria-label*="주소"]').first()
          const ariaLabel = await addrBtn.getAttribute('aria-label', { timeout: 3000 })
          if (ariaLabel) {
            address = ariaLabel.replace(/^주소:\s*/, '').trim()
          }
        } catch {
          // no-op
        }
      }

      // Extract phone - data-item-id starts with "phone"
      let phone = ''
      try {
        const phoneBtn = page.locator('button[data-item-id^="phone:"]').first()
        const ariaLabel = await phoneBtn.getAttribute('aria-label', { timeout: 3000 })
        if (ariaLabel) {
          phone = ariaLabel.replace(/^전화:\s*/, '').replace(/^전화번호:\s*/, '').trim()
        }
      } catch {
        // no-op
      }
      if (!phone) {
        try {
          const phoneBtn = page.locator('button[aria-label*="전화"]').first()
          const ariaLabel = await phoneBtn.getAttribute('aria-label', { timeout: 2000 })
          if (ariaLabel) {
            // Make sure it's not "휴대전화로 보내기"
            if (!ariaLabel.includes('휴대전화로 보내기')) {
              phone = ariaLabel.replace(/^전화:\s*/, '').replace(/^전화번호:\s*/, '').trim()
            }
          }
        } catch {
          // no-op
        }
      }

      // Extract hours
      let hours = ''
      try {
        // Try aria-label on hours element
        const hoursEl = page.locator('[data-item-id="oh"]').first()
        const ariaLabel = await hoursEl.getAttribute('aria-label', { timeout: 3000 })
        if (ariaLabel) {
          hours = ariaLabel.trim()
        } else {
          hours = (await hoursEl.textContent({ timeout: 2000 }))?.trim() ?? ''
        }
      } catch {
        // no-op
      }
      if (!hours) {
        try {
          const hoursBtn = page.locator('button[aria-label*="영업시간"]').first()
          hours = (await hoursBtn.getAttribute('aria-label', { timeout: 2000 })) ?? ''
          hours = hours.trim()
        } catch {
          // no-op
        }
      }

      // Extract rating
      let rating = ''
      try {
        // Rating is typically in a span with role=img aria-label containing stars info
        // Or in div.F7nice span
        const ratingEl = page.locator('div.F7nice span[aria-hidden="true"]').first()
        rating = (await ratingEl.textContent({ timeout: 3000 }))?.trim() ?? ''
      } catch {
        // no-op
      }
      if (!rating) {
        try {
          const ratingEl = page.locator('span.ceNzKf').first()
          rating = (await ratingEl.textContent({ timeout: 2000 }))?.trim() ?? ''
        } catch {
          // no-op
        }
      }

      // Extract coordinates from URL
      const finalUrl = page.url()
      const { lat, lng } = extractCoordsFromUrl(finalUrl)

      const result: ShopResult = {
        name,
        address,
        phone,
        hours,
        rating,
        lat,
        lng,
        searchQuery: query,
      }

      results.push(result)
      console.log(`  -> Found: ${name}`)
      console.log(`     Address: ${address}`)
      console.log(`     Phone: ${phone}`)
      console.log(`     Hours: ${hours}`)
      console.log(`     Rating: ${rating}`)
      console.log(`     Coords: ${lat}, ${lng}`)
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
  const outputPath = path.join(__dirname, 'gmap-gyeonggi-results.json')
  writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8')

  console.log('\n' + '='.repeat(60))
  console.log(`Results written to: ${outputPath}`)
  console.log(`Total searched: ${QUERIES.length}`)
  console.log(`Successfully found: ${results.length}`)
  console.log(`Failed/skipped: ${failed.length}`)
  if (failed.length > 0) {
    console.log(`Failed queries: ${failed.join(', ')}`)
  }
  console.log('='.repeat(60))

  // Print summary table
  console.log('\n--- Results Summary ---')
  for (const r of results) {
    console.log(`\n  Query: ${r.searchQuery}`)
    console.log(`  Name: ${r.name}`)
    console.log(`  Address: ${r.address}`)
    console.log(`  Phone: ${r.phone}`)
    console.log(`  Hours: ${r.hours}`)
    console.log(`  Rating: ${r.rating}`)
    console.log(`  Coords: ${r.lat}, ${r.lng}`)
  }
}

main().catch(console.error)
