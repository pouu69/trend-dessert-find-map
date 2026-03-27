import type { Page } from 'playwright'
import type { EnrichedShop } from './types'
import { sleep } from './utils'
import { safeGoto, waitForSelector } from './browser'

/**
 * Search Google Maps for a shop and extract business information.
 *
 * CRITICAL: Never use waitForLoadState('networkidle') — Google Maps
 * streams data continuously and networkidle will hang forever.
 * Instead we use domcontentloaded + explicit selector waits.
 */
export async function searchGoogleMaps(
  page: Page,
  shopName: string,
  city: string,
  delayMs: number,
): Promise<Partial<EnrichedShop> | null> {
  const query = encodeURIComponent(`${shopName} ${city}`)
  const url = `https://www.google.com/maps/search/${query}`

  try {
    const ok = await safeGoto(page, url, { timeout: 15000 })
    if (!ok) return null

    await sleep(delayMs)

    // Click first result if list appears
    const firstResult = page.locator('a[href*="/maps/place/"]').first()
    const hasResults = await firstResult.count().catch(() => 0)
    if (hasResults > 0) {
      await firstResult.click()
      // Wait for detail panel to appear — NOT networkidle
      await waitForSelector(page, 'h1.DUwDvf, h1[data-attrid="title"]', 10000)
      await sleep(delayMs)
    }

    const info = await extractBusinessInfo(page)

    // Wait for URL to update with coordinates
    await sleep(1000)
    const coords = parseCoordinatesFromUrl(page.url())

    return {
      ...info,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    }
  } catch (error) {
    console.warn(`  [gmaps] Failed: "${shopName}" — ${error instanceof Error ? error.message : error}`)
    return null
  }
}

async function extractBusinessInfo(page: Page): Promise<Partial<EnrichedShop>> {
  const name = await page.$eval(
    'h1.DUwDvf, h1[data-attrid="title"]',
    el => el.textContent?.trim() || '',
  ).catch(() => '')

  const address = await page.$eval(
    'button[data-item-id="address"] .Io6YTe, [data-tooltip="주소 복사"]',
    el => el.textContent?.trim() || '',
  ).catch(() => '')

  const phone = await page.$eval(
    'button[data-item-id^="phone:"] .Io6YTe, [data-tooltip="전화번호 복사"]',
    el => el.textContent?.trim() || '',
  ).catch(() => '')

  const hours = await page.$eval(
    '[data-item-id="oh"] .Io6YTe, .o7FIqe .ZDu9vd',
    el => el.textContent?.trim() || '',
  ).catch(() => '')

  const rating = await page.$eval(
    'div.F7nice span[aria-hidden="true"]',
    el => el.textContent?.trim() || '',
  ).catch(() => '')

  const reviewCount = await page.$eval(
    'div.F7nice span[aria-label*="리뷰"], div.F7nice span[aria-label*="review"]',
    el => {
      const match = el.getAttribute('aria-label')?.match(/[\d,]+/)
      return match ? match[0].replace(/,/g, '') : ''
    },
  ).catch(() => '')

  const category = await page.$eval(
    'button.DkEaL, span.DkEaL',
    el => el.textContent?.trim() || '',
  ).catch(() => '')

  return { name, address, phone, hours, rating, reviewCount, category }
}

export function parseCoordinatesFromUrl(url: string): { lat: number; lng: number } | null {
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) }
  }

  const bangMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (bangMatch) {
    return { lat: parseFloat(bangMatch[1]), lng: parseFloat(bangMatch[2]) }
  }

  return null
}

/**
 * Nominatim geocoding fallback for shops without coordinates.
 * Rate limited to 1 req/sec per Nominatim usage policy.
 */
export async function geocodeWithNominatim(
  address: string,
  delayMs: number,
): Promise<{ lat: number; lng: number } | null> {
  const clean = address
    .replace(/KR\s*/g, '')
    .replace(/\d+층/g, '')
    .replace(/\d+호/g, '')
    .replace(/번지/g, '')
    .replace(/\(.*\)/g, '')
    .trim()

  const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=kr&q=${encodeURIComponent(clean)}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'trendeat-pipeline/2.0' },
    })
    const results = (await res.json()) as { lat: string; lon: string }[]

    if (results.length > 0) {
      const lat = parseFloat(results[0].lat)
      const lng = parseFloat(results[0].lon)
      // Validate coordinates are within South Korea bounds
      if (lat > 33 && lat < 39 && lng > 124.5 && lng < 132) {
        return { lat, lng }
      }
    }
  } catch (error) {
    console.warn(`  [nominatim] Failed: "${address}" — ${error instanceof Error ? error.message : error}`)
  }

  await sleep(delayMs)
  return null
}
