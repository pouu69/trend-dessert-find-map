import { chromium, type Page } from 'playwright'

export interface RawShop {
  name: string
  address: string
  phone: string
  hours: string
  category: string
  source: 'naver' | 'kakao'
}

async function extractShopsFromPage(page: Page): Promise<RawShop[]> {
  const shops: RawShop[] = []

  // Naver Maps search results are inside an iframe
  const searchIframe = page.frameLocator('#searchIframe')

  // Wait for search results to load
  await searchIframe.locator('.CHC5F').first().waitFor({ timeout: 10000 }).catch(() => null)

  // Get all result items
  const items = searchIframe.locator('.CHC5F')
  const count = await items.count()

  for (let i = 0; i < count; i++) {
    try {
      const item = items.nth(i)
      const name = await item.locator('.place_bluelink > span').first().textContent() ?? ''
      const category = await item.locator('.KCMnt').first().textContent() ?? ''

      // Click to get detail info
      await item.locator('.place_bluelink').first().click()
      await page.waitForTimeout(1000)

      const detailIframe = page.frameLocator('#entryIframe')
      const address = await detailIframe.locator('.LDgIH').first().textContent().catch(() => '') ?? ''
      const phone = await detailIframe.locator('.xlx7Q').first().textContent().catch(() => '') ?? ''
      const hours = await detailIframe.locator('.A_cdD .i8cJw').first().textContent().catch(() => '') ?? ''

      if (name) {
        shops.push({
          name: name.trim(),
          address: address.trim(),
          phone: phone.trim(),
          hours: hours.trim(),
          category: category.trim(),
          source: 'naver',
        })
      }

      // Go back to list
      await page.goBack()
      await page.waitForTimeout(500)
    } catch (e) {
      console.warn(`[naver] Failed to extract shop at index ${i}:`, e)
      continue
    }
  }

  return shops
}

export async function crawlNaver(keyword: string): Promise<RawShop[]> {
  console.log('[naver] Starting Naver Maps crawl...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  })
  const page = await context.newPage()

  const allShops: RawShop[] = []

  try {
    const searchUrl = `https://map.naver.com/p/search/${encodeURIComponent(keyword)}`
    await page.goto(searchUrl, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    const shops = await extractShopsFromPage(page)
    allShops.push(...shops)

    // Try next pages (up to 3 pages)
    for (let pageNum = 2; pageNum <= 3; pageNum++) {
      try {
        const searchIframe = page.frameLocator('#searchIframe')
        const nextBtn = searchIframe.locator(`a.mBN2s[data-nclk-aid="${pageNum}"]`).first()
        if (await nextBtn.isVisible()) {
          await nextBtn.click()
          await page.waitForTimeout(2000)
          const pageShops = await extractShopsFromPage(page)
          allShops.push(...pageShops)
        } else {
          break
        }
      } catch {
        break
      }
    }
  } catch (e) {
    console.error('[naver] Crawl failed:', e)
  } finally {
    await browser.close()
  }

  console.log(`[naver] Collected ${allShops.length} shops`)
  return allShops
}
