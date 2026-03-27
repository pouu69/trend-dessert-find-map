import type { Page } from 'playwright'
import type { EnrichedShop } from './types'
import { launchBrowser, safeGoto, waitForSelector } from './browser'
import { sleep } from './utils'

/**
 * Search Kakao Maps for a shop by name and return enriched data.
 * Used for ENRICHMENT (not discovery) — we already know the shop name from blog crawling.
 */
export async function searchKakaoMaps(
  page: Page,
  shopName: string,
  address: string,
  delayMs: number,
): Promise<Partial<EnrichedShop> | null> {
  // Search by shop name + address hint for better accuracy
  const query = address
    ? `${shopName} ${address.split(/\s+/).slice(0, 2).join(' ')}`
    : shopName
  const searchUrl = `https://map.kakao.com/?q=${encodeURIComponent(query)}`

  try {
    const ok = await safeGoto(page, searchUrl, { timeout: 20000 })
    if (!ok) return null
    await sleep(delayMs)

    const listLoaded = await waitForSelector(page, '#info\\.search\\.place\\.list')
    if (!listLoaded) return null

    // Get first result
    const firstItem = page.locator('.placelist > .PlaceItem').first()
    const hasResult = await firstItem.count().catch(() => 0)
    if (hasResult === 0) return null

    const name = await firstItem.locator('.head_item .tit_name .link_name').textContent().catch(() => '') ?? ''
    const resultAddress = await firstItem.locator('.addr p:first-child').textContent().catch(() => '') ?? ''
    const phone = await firstItem.locator('.contact .phone').textContent().catch(() => '') ?? ''
    const category = await firstItem.locator('.head_item .subcategory').textContent().catch(() => '') ?? ''
    const hours = await firstItem.locator('.openhour .txt_operation').textContent().catch(() => '') ?? ''

    return {
      name: name.trim() || undefined,
      address: resultAddress.trim() || undefined,
      phone: phone.trim() || undefined,
      hours: hours.trim() || undefined,
      category: category.trim() || undefined,
      enrichedBy: 'kakao-maps',
    }
  } catch (error) {
    console.warn(`  [kakao] Failed: "${shopName}" — ${error instanceof Error ? error.message : error}`)
    return null
  }
}

/**
 * Enrich a batch of shops using Kakao Maps.
 * Returns enrichment data keyed by shop name.
 */
export async function enrichWithKakaoMaps(
  shops: readonly { name: string; address: string }[],
  delayMs: number,
): Promise<Map<string, Partial<EnrichedShop>>> {
  const results = new Map<string, Partial<EnrichedShop>>()

  const { browser, context } = await launchBrowser()
  const page = await context.newPage()

  try {
    for (let i = 0; i < shops.length; i++) {
      const shop = shops[i]
      console.log(`  [kakao ${i + 1}/${shops.length}] "${shop.name}"`)

      const data = await searchKakaoMaps(page, shop.name, shop.address, delayMs)
      if (data) {
        results.set(shop.name, data)
      }

      await sleep(delayMs)
    }
  } finally {
    await page.close()
    await browser.close()
  }

  return results
}
