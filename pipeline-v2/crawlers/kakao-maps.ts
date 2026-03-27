import type { RawShop, CrawlResult, PipelineConfig } from '../lib/types'
import { launchBrowser, safeGoto, waitForSelector } from '../lib/browser'
import { sleep, loadConfig } from '../lib/utils'
import type { Page } from 'playwright'

async function extractShopsFromKakaoPage(
  page: Page,
  keyword: string,
): Promise<RawShop[]> {
  const shops: RawShop[] = []

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
        shops.push({
          name: name.trim(),
          address: address.trim(),
          phone: phone.trim(),
          hours: hours.trim(),
          category: category.trim(),
          source: 'kakao-maps',
          keyword,
          blogUrl: '',
        })
      }
    } catch {
      continue
    }
  }

  return shops
}

export async function crawlKakaoMaps(config: PipelineConfig): Promise<CrawlResult> {
  const start = Date.now()
  const errors: string[] = []
  const keyword = config.product

  console.log(`[kakao-maps] Searching: "${keyword}"`)

  const { browser, context } = await launchBrowser()
  const allShops: RawShop[] = []

  try {
    const page = await context.newPage()
    const searchUrl = `https://map.kakao.com/?q=${encodeURIComponent(keyword)}`

    const ok = await safeGoto(page, searchUrl, { timeout: 20000 })
    if (!ok) {
      errors.push('Kakao Maps initial navigation failed — site may be blocking')
      return { source: 'kakao-maps', shops: [], errors, duration: Date.now() - start }
    }
    await sleep(2000)

    const listLoaded = await waitForSelector(page, '#info\\.search\\.place\\.list')
    if (!listLoaded) {
      errors.push('Kakao Maps search results did not load — possible anti-bot')
      return { source: 'kakao-maps', shops: allShops, errors, duration: Date.now() - start }
    }

    const shops = await extractShopsFromKakaoPage(page, keyword)
    allShops.push(...shops)

    for (let pageNum = 2; pageNum <= 3; pageNum++) {
      try {
        const nextBtn = page.locator(`#info\\.search\\.page\\.no${pageNum}`)
        if (await nextBtn.isVisible()) {
          await nextBtn.click()
          await sleep(2000)
          const pageShops = await extractShopsFromKakaoPage(page, keyword)
          allShops.push(...pageShops)
        } else {
          break
        }
      } catch {
        break
      }
    }

    await page.close()
  } catch (error) {
    errors.push(`Kakao Maps crawl error: ${error instanceof Error ? error.message : error}`)
  } finally {
    await browser.close()
  }

  return { source: 'kakao-maps', shops: allShops, errors, duration: Date.now() - start }
}

if (process.argv[1]?.endsWith('kakao-maps.ts')) {
  const config = loadConfig()
  crawlKakaoMaps(config)
    .then(result => {
      console.log(`[kakao-maps] Done: ${result.shops.length} shops, ${result.errors.length} errors`)
    })
    .catch(err => {
      console.error('[kakao-maps] Fatal:', err)
      process.exit(1)
    })
}
