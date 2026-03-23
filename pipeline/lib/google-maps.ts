import type { Page } from 'playwright'
import type { EnrichedShop } from './types'
import { sleep } from './utils'

/**
 * Search Google Maps for a shop and extract business information.
 */
export async function searchGoogleMaps(
  page: Page,
  shopName: string,
  city: string,
  delayMs: number
): Promise<Partial<EnrichedShop> | null> {
  const query = encodeURIComponent(`${shopName} ${city}`)
  const url = `https://www.google.com/maps/search/${query}`

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await sleep(delayMs)

    // Click the first result if a list appears
    const firstResult = page.locator('a[href*="/maps/place/"]').first()
    const hasResults = await firstResult.count().catch(() => 0)
    if (hasResults > 0) {
      await firstResult.click()
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {})
      await sleep(3000)
    }

    // Extract business info from detail panel
    const info = await extractBusinessInfo(page)

    // Wait for URL to settle with coordinate data
    await sleep(1000)
    const coords = parseCoordinatesFromUrl(page.url())

    return {
      ...info,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    }
  } catch (error) {
    console.error(`  Google Maps search failed for "${shopName}": ${error instanceof Error ? error.message : error}`)
    return null
  }
}

/**
 * Extract business information from the Google Maps detail panel.
 */
async function extractBusinessInfo(page: Page): Promise<Partial<EnrichedShop>> {
  const info: Partial<EnrichedShop> = {}

  // Name
  info.name = await page.$eval(
    'h1.DUwDvf, h1[data-attrid="title"]',
    el => el.textContent?.trim() || ''
  ).catch(() => '')

  // Address
  info.address = await page.$eval(
    'button[data-item-id="address"] .Io6YTe, [data-tooltip="주소 복사"]',
    el => el.textContent?.trim() || ''
  ).catch(() => '')

  // Phone
  info.phone = await page.$eval(
    'button[data-item-id^="phone:"] .Io6YTe, [data-tooltip="전화번호 복사"]',
    el => el.textContent?.trim() || ''
  ).catch(() => '')

  // Hours
  info.hours = await page.$eval(
    '[data-item-id="oh"] .Io6YTe, .o7FIqe .ZDu9vd',
    el => el.textContent?.trim() || ''
  ).catch(() => '')

  // Rating
  info.rating = await page.$eval(
    'div.F7nice span[aria-hidden="true"]',
    el => el.textContent?.trim() || ''
  ).catch(() => '')

  // Review count
  info.reviewCount = await page.$eval(
    'div.F7nice span[aria-label*="리뷰"], div.F7nice span[aria-label*="review"]',
    el => {
      const match = el.getAttribute('aria-label')?.match(/[\d,]+/)
      return match ? match[0].replace(/,/g, '') : ''
    }
  ).catch(() => '')

  // Category
  info.category = await page.$eval(
    'button.DkEaL, span.DkEaL',
    el => el.textContent?.trim() || ''
  ).catch(() => '')

  return info
}

/**
 * Parse latitude and longitude from a Google Maps URL.
 * Supports formats: @lat,lng and !3d{lat}!4d{lng}
 */
export function parseCoordinatesFromUrl(url: string): { lat: number; lng: number } | null {
  // Try @lat,lng,zoom format
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) }
  }

  // Try !3d{lat}!4d{lng} format
  const bangMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (bangMatch) {
    return { lat: parseFloat(bangMatch[1]), lng: parseFloat(bangMatch[2]) }
  }

  return null
}
