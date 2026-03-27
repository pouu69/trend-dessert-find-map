import type { Page } from 'playwright'
import type { RawShop, CrawlSource } from './types'

export async function extractShopsFromBlogPost(
  page: Page,
  keyword: string,
  blogUrl: string,
): Promise<RawShop[]> {
  const shops: RawShop[] = []
  const source: CrawlSource = 'naver-blog'

  // Switch to blog post iframe if present
  let contentFrame = page
  try {
    const frameElement = await page.$('#mainFrame')
    if (frameElement) {
      const frame = await frameElement.contentFrame()
      if (frame) {
        contentFrame = frame as unknown as Page
      }
    }
  } catch {
    // No iframe — use main page
  }

  // 1. Look for Naver Place links
  const placeLinks = await contentFrame.$$eval(
    'a[href*="place.naver.com"], a[href*="map.naver.com/entry/place"]',
    (links: HTMLAnchorElement[]) => links.map(a => ({
      href: a.href,
      text: a.textContent?.trim() || '',
    })),
  ).catch(() => [])

  for (const link of placeLinks) {
    const name = link.text || ''
    if (name.length > 1 && name.length < 50) {
      shops.push({ name, address: '', phone: '', hours: '', category: '', source, keyword, blogUrl })
    }
  }

  // 2. Extract text content and look for address/phone patterns
  const textContent = await contentFrame.evaluate(() => {
    const el = document.querySelector('.se-main-container')
      || document.querySelector('.post-view')
      || document.querySelector('#content')
      || document.body
    return el?.textContent || ''
  }).catch(() => '')

  const addressPattern = /([가-힣]+(?:특별시|광역시|특별자치시|도)\s+[가-힣]+(?:시|군|구)\s+[가-힣0-9\s]+(?:로|길)\s*[0-9\-]+(?:\s*[가-힣0-9\-]+)?)/g
  const addresses = textContent.match(addressPattern) || []

  const phonePattern = /(0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4})/g
  const phones = textContent.match(phonePattern) || []

  // If no place links found but addresses exist, try heuristic name extraction
  if (shops.length === 0 && addresses.length > 0) {
    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i]
      const addrIndex = textContent.indexOf(addr)
      const nearbyText = textContent.substring(Math.max(0, addrIndex - 200), addrIndex)

      const nameMatch = nearbyText.match(
        /([가-힣A-Za-z0-9\s]{2,20}(?:카페|빵집|베이커리|제과|당|점|관|집|방|파티세리|아뜰리에))/g,
      )
      const name = nameMatch ? nameMatch[nameMatch.length - 1].trim() : ''

      if (name) {
        shops.push({ name, address: addr.trim(), phone: phones[i] || '', hours: '', category: '', source, keyword, blogUrl })
      }
    }
  }

  // Fill missing addresses/phones from first found values
  const firstAddress = addresses[0]?.trim() ?? ''
  const firstPhone = phones[0]?.trim() ?? ''
  for (let i = 0; i < shops.length; i++) {
    const shop = shops[i]
    if (shop && !shop.address && firstAddress) {
      shops[i] = { ...shop, address: firstAddress }
    }
    const updated = shops[i]
    if (updated && !updated.phone && firstPhone) {
      shops[i] = { ...updated, phone: firstPhone }
    }
  }

  return shops
}
