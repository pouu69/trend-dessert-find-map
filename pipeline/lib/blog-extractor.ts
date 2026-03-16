import type { Page } from 'playwright'
import type { RawShop } from './types'

/**
 * Extract shop information from a Naver blog post page.
 * Looks for Naver Place links, road addresses, and phone numbers.
 */
export async function extractShopsFromBlogPost(
  page: Page,
  keyword: string,
  blogUrl: string
): Promise<RawShop[]> {
  const shops: RawShop[] = []

  // Switch to the blog post iframe if present (Naver blog posts are often in iframes)
  let contentFrame = page
  try {
    const iframe = page.frameLocator('#mainFrame')
    const iframeBody = iframe.locator('body')
    const hasIframe = await iframeBody.count().catch(() => 0)
    if (hasIframe > 0) {
      // Work within the iframe
      const frameElement = await page.$('#mainFrame')
      if (frameElement) {
        const frame = await frameElement.contentFrame()
        if (frame) {
          contentFrame = frame as unknown as Page
        }
      }
    }
  } catch {
    // No iframe, use main page
  }

  // 1. Look for Naver Place links
  const placeLinks = await contentFrame.$$eval(
    'a[href*="place.naver.com"], a[href*="map.naver.com/entry/place"]',
    (links: HTMLAnchorElement[]) => links.map(a => ({
      href: a.href,
      text: a.textContent?.trim() || ''
    }))
  ).catch(() => [])

  for (const link of placeLinks) {
    const name = link.text || ''
    if (name && name.length > 1 && name.length < 50) {
      shops.push({
        name,
        address: '',
        phone: '',
        hours: '',
        category: '',
        source: 'naver-place',
        keyword,
        blogUrl,
      })
    }
  }

  // 2. Extract text content and look for address/phone patterns
  const textContent = await contentFrame.evaluate(() => {
    const el = document.querySelector('.se-main-container') ||
               document.querySelector('.post-view') ||
               document.querySelector('#content') ||
               document.body
    return el?.textContent || ''
  }).catch(() => '')

  // Korean road address pattern (도로명주소)
  const addressPattern = /([가-힣]+(?:특별시|광역시|특별자치시|도)\s+[가-힣]+(?:시|군|구)\s+[가-힣0-9\s]+(?:로|길)\s*[0-9\-]+(?:\s*[가-힣0-9\-]+)?)/g
  const addresses = textContent.match(addressPattern) || []

  // Phone number pattern
  const phonePattern = /(0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4})/g
  const phones = textContent.match(phonePattern) || []

  // Shop name pattern - look for bold or heading text near addresses
  // This is a heuristic: if we found addresses but no place links, try to extract names
  if (shops.length === 0 && addresses.length > 0) {
    for (let i = 0; i < addresses.length; i++) {
      // Try to find a shop name near the address in the text
      const addr = addresses[i]
      const addrIndex = textContent.indexOf(addr)
      const nearbyText = textContent.substring(Math.max(0, addrIndex - 200), addrIndex)

      // Look for a name-like string (2-20 chars, Korean)
      const nameMatch = nearbyText.match(/([가-힣A-Za-z0-9\s]{2,20}(?:카페|빵집|베이커리|제과|당|점|관|집|방|파티세리|아뜰리에))/g)
      const name = nameMatch ? nameMatch[nameMatch.length - 1].trim() : ''

      if (name) {
        shops.push({
          name,
          address: addr.trim(),
          phone: phones[i] || '',
          hours: '',
          category: '',
          source: 'naver-blog',
          keyword,
          blogUrl,
        })
      }
    }
  }

  // If we found place-linked shops, try to fill in addresses
  for (const shop of shops) {
    if (!shop.address && addresses.length > 0) {
      shop.address = addresses[0].trim()
    }
    if (!shop.phone && phones.length > 0) {
      shop.phone = phones[0].trim()
    }
  }

  return shops
}
