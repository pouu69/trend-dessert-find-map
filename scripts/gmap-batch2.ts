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

const SHOPS = [
  '하츠베이커리 노원점',
  '하츠베이커리 논현점',
  '하츠베이커리 압구정점',
  '하츠베이커리 선릉점',
  '하츠베이커리 잠실점',
  '하츠베이커리 은평점',
  '하츠베이커리 성수점',
  '하츠베이커리 서초점',
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

  for (let i = 0; i < SHOPS.length; i++) {
    const query = SHOPS[i]
    console.log(`[${i + 1}/${SHOPS.length}] Searching: ${query}`)

    try {
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })

      // Wait longer for Google Maps to finish loading/redirecting
      await page.waitForTimeout(4000)

      // Check for CAPTCHA
      const captcha = await page.locator('#captcha-form, .g-recaptcha, iframe[src*="recaptcha"]').count()
      if (captcha > 0) {
        console.log('CAPTCHA detected! Stopping.')
        break
      }

      const currentUrl = page.url()
      console.log(`  -> URL: ${currentUrl}`)
      const isDirectPlace = currentUrl.includes('/place/')

      if (!isDirectPlace) {
        // Try to wait for either a place redirect or search results
        let clicked = false

        // Try waiting a bit more for potential redirect
        await page.waitForTimeout(2000)
        const urlAfterWait = page.url()
        if (urlAfterWait.includes('/place/')) {
          // It redirected while we waited
          console.log(`  -> Redirected to place page`)
        } else {
          // We're on search results, try clicking first result
          // Method 1: feed items with links
          try {
            const resultItem = page.locator('div[role="feed"] > div > div > a').first()
            await resultItem.waitFor({ timeout: 5000 })
            await resultItem.click()
            clicked = true
          } catch { /* try next */ }

          // Method 2: place links
          if (!clicked) {
            try {
              const altResult = page.locator('a[href*="/maps/place/"]').first()
              await altResult.waitFor({ timeout: 5000 })
              await altResult.click()
              clicked = true
            } catch { /* try next */ }
          }

          // Method 3: .Nv2PK items
          if (!clicked) {
            try {
              const nvResult = page.locator('.Nv2PK').first()
              await nvResult.waitFor({ timeout: 3000 })
              await nvResult.click()
              clicked = true
            } catch { /* nope */ }
          }

          if (!clicked) {
            // Last resort: maybe there's a single result that hasn't been detected
            // Check if h1 is present (place detail loaded without URL changing)
            const h1Count = await page.locator('h1').count()
            if (h1Count === 0) {
              console.log(`  -> No results found for: ${query}`)
              failed.push(query)
              await page.waitForTimeout(1000)
              continue
            }
          }

          await page.waitForTimeout(3000)
        }
      }

      // Wait for the detail panel
      await page.waitForTimeout(2000)

      // Wait specifically for h1 to appear (place name)
      try {
        await page.locator('h1').first().waitFor({ timeout: 5000 })
      } catch {
        console.log(`  -> Place detail panel did not load for: ${query}`)
        failed.push(query)
        continue
      }

      // Extract all data using page.evaluate for maximum reliability
      const data = await page.evaluate(() => {
        // Name: h1 text
        const h1 = document.querySelector('h1')
        const name = h1?.textContent?.trim() ?? ''

        // Address: button whose aria-label starts with "주소:"
        let address = ''
        const allButtons = document.querySelectorAll('button[aria-label]')
        for (const btn of allButtons) {
          const label = btn.getAttribute('aria-label') ?? ''
          if (label.startsWith('주소:')) {
            address = label.replace(/^주소:\s*/, '').trim()
            break
          }
        }
        // Fallback: data-item-id="address"
        if (!address) {
          const addrEl = document.querySelector('button[data-item-id="address"]')
          if (addrEl) {
            const label = addrEl.getAttribute('aria-label') ?? ''
            address = label.replace(/^주소:\s*/, '').trim()
          }
        }

        // Phone: button whose aria-label starts with "전화:"
        let phone = ''
        for (const btn of allButtons) {
          const label = btn.getAttribute('aria-label') ?? ''
          if (label.startsWith('전화:')) {
            phone = label.replace(/^전화:\s*/, '').trim()
            break
          }
        }
        // Fallback
        if (!phone) {
          const phoneEl = document.querySelector('button[data-item-id^="phone:"]')
          if (phoneEl) {
            const label = phoneEl.getAttribute('aria-label') ?? ''
            phone = label.replace(/^전화:\s*/, '').replace(/^전화번호:\s*/, '').trim()
          }
        }

        // Hours
        let hours = ''
        const ohEl = document.querySelector('[data-item-id="oh"]')
        if (ohEl) {
          hours = ohEl.getAttribute('aria-label')?.trim() ?? ohEl.textContent?.trim() ?? ''
        }
        if (!hours) {
          for (const btn of allButtons) {
            const label = btn.getAttribute('aria-label') ?? ''
            if (label.includes('시간') || label.includes('영업')) {
              // Skip buttons that are just "영업시간" text with no actual data
              if (label.length > 5) {
                hours = label.trim()
                break
              }
            }
          }
        }

        // Rating
        let rating = ''
        // Look for the star image aria-label pattern "별표 X.X개"
        const starImg = document.querySelector('img[aria-label*="별표"]')
        if (starImg) {
          const label = starImg.getAttribute('aria-label') ?? ''
          const m = label.match(/([\d.]+)/)
          if (m) rating = m[1]
        }
        // Fallback: .fontDisplayLarge or .MW4etd
        if (!rating) {
          const ratingEl = document.querySelector('.fontDisplayLarge, .MW4etd')
          if (ratingEl) {
            const txt = ratingEl.textContent?.trim() ?? ''
            if (/^\d+(\.\d+)?$/.test(txt)) {
              rating = txt
            }
          }
        }

        return { name, address, phone, hours, rating }
      })

      if (!data.name) {
        console.log(`  -> Could not extract name for: ${query}`)
        failed.push(query)
        await page.waitForTimeout(1000)
        continue
      }

      // Extract coordinates from URL
      const finalUrl = page.url()
      const { lat, lng } = extractCoordsFromUrl(finalUrl)

      const result: ShopResult = {
        name: data.name,
        searchQuery: query,
        address: data.address,
        phone: data.phone,
        hours: data.hours,
        rating: data.rating,
        lat,
        lng,
      }

      results.push(result)
      console.log(`  -> Found: ${data.name} | ${data.address} | ${data.phone} | rating:${data.rating} | hours:${data.hours} | coords:${lat},${lng}`)
    } catch (err) {
      console.log(`  -> Error for ${query}: ${err instanceof Error ? err.message : err}`)
      failed.push(query)
    }

    // Wait between requests
    if (i < SHOPS.length - 1) {
      await page.waitForTimeout(2000)
    }
  }

  await browser.close()

  // Write results
  const outputPath = path.join(__dirname, 'gmap-batch2-results.json')
  writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8')

  console.log('\n' + '='.repeat(60))
  console.log(`Results written to: ${outputPath}`)
  console.log(`Total searched: ${SHOPS.length}`)
  console.log(`Successfully found: ${results.length}`)
  console.log(`Failed/skipped: ${failed.length}`)
  if (failed.length > 0) {
    console.log(`Failed shops: ${failed.join(', ')}`)
  }
  console.log('='.repeat(60))

  // Print results
  console.log('\nResults:')
  console.log(JSON.stringify(results, null, 2))
}

main().catch(console.error)
