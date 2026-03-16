import { chromium } from 'playwright'
import type { RawShop } from './crawl-naver'

export async function crawlKakao(keyword: string): Promise<RawShop[]> {
  console.log('[kakao] Starting KakaoMap crawl...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  })
  const page = await context.newPage()

  const allShops: RawShop[] = []

  try {
    const searchUrl = `https://map.kakao.com/?q=${encodeURIComponent(keyword)}`
    await page.goto(searchUrl, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // Wait for results list
    await page.locator('#info\\.search\\.place\\.list').waitFor({ timeout: 10000 }).catch(() => null)

    const items = page.locator('.placelist > .PlaceItem')
    const count = await items.count()

    for (let i = 0; i < count; i++) {
      try {
        const item = items.nth(i)
        const name = await item.locator('.head_item .tit_name .link_name').textContent() ?? ''
        const address = await item.locator('.addr p:first-child').textContent() ?? ''
        const phone = await item.locator('.contact .phone').textContent().catch(() => '') ?? ''
        const category = await item.locator('.head_item .subcategory').textContent().catch(() => '') ?? ''
        const hours = await item.locator('.openhour .txt_operation').textContent().catch(() => '') ?? ''

        if (name) {
          allShops.push({
            name: name.trim(),
            address: address.trim(),
            phone: phone.trim(),
            hours: hours.trim(),
            category: category.trim(),
            source: 'kakao',
          })
        }
      } catch (e) {
        console.warn(`[kakao] Failed to extract shop at index ${i}:`, e)
        continue
      }
    }

    // Try next pages
    for (let pageNum = 2; pageNum <= 3; pageNum++) {
      try {
        const nextBtn = page.locator(`#info\\.search\\.page\\.no${pageNum}`)
        if (await nextBtn.isVisible()) {
          await nextBtn.click()
          await page.waitForTimeout(2000)

          const pageItems = page.locator('.placelist > .PlaceItem')
          const pageCount = await pageItems.count()

          for (let i = 0; i < pageCount; i++) {
            try {
              const item = pageItems.nth(i)
              const name = await item.locator('.head_item .tit_name .link_name').textContent() ?? ''
              const address = await item.locator('.addr p:first-child').textContent() ?? ''
              const phone = await item.locator('.contact .phone').textContent().catch(() => '') ?? ''
              const category = await item.locator('.head_item .subcategory').textContent().catch(() => '') ?? ''
              const hours = await item.locator('.openhour .txt_operation').textContent().catch(() => '') ?? ''

              if (name) {
                allShops.push({
                  name: name.trim(),
                  address: address.trim(),
                  phone: phone.trim(),
                  hours: hours.trim(),
                  category: category.trim(),
                  source: 'kakao',
                })
              }
            } catch {
              continue
            }
          }
        } else {
          break
        }
      } catch {
        break
      }
    }
  } catch (e) {
    console.error('[kakao] Crawl failed:', e)
  } finally {
    await browser.close()
  }

  console.log(`[kakao] Collected ${allShops.length} shops`)
  return allShops
}
