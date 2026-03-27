import type { RawShop, CrawlResult, PipelineConfig } from '../lib/types'
import { launchBrowser, safeGoto } from '../lib/browser'
import { sleep, loadConfig } from '../lib/utils'
import type { Page } from 'playwright'

async function extractShopsFromNaverMaps(
  page: Page,
  keyword: string,
): Promise<RawShop[]> {
  const shops: RawShop[] = []
  const searchIframe = page.frameLocator('#searchIframe')

  try {
    await searchIframe.locator('.CHC5F').first().waitFor({ timeout: 10000 })
  } catch {
    return shops
  }

  const items = searchIframe.locator('.CHC5F')
  const count = await items.count()

  for (let i = 0; i < count; i++) {
    try {
      const item = items.nth(i)
      const name = await item.locator('.place_bluelink > span').first().textContent() ?? ''
      const category = await item.locator('.KCMnt').first().textContent() ?? ''

      await item.locator('.place_bluelink').first().click()
      await sleep(1000)

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
          source: 'naver-maps',
          keyword,
          blogUrl: '',
        })
      }

      await page.goBack()
      await sleep(500)
    } catch {
      continue
    }
  }

  return shops
}

export async function crawlNaverMaps(config: PipelineConfig): Promise<CrawlResult> {
  const start = Date.now()
  const errors: string[] = []
  const keyword = config.product

  console.log(`[naver-maps] Searching: "${keyword}"`)

  const { browser, context } = await launchBrowser()
  const allShops: RawShop[] = []

  try {
    const page = await context.newPage()
    const searchUrl = `https://map.naver.com/p/search/${encodeURIComponent(keyword)}`

    const ok = await safeGoto(page, searchUrl, { timeout: 20000 })
    if (!ok) {
      errors.push('Naver Maps initial navigation failed')
      return { source: 'naver-maps', shops: [], errors, duration: Date.now() - start }
    }
    await sleep(2000)

    const shops = await extractShopsFromNaverMaps(page, keyword)
    allShops.push(...shops)

    for (let pageNum = 2; pageNum <= 3; pageNum++) {
      try {
        const searchIframe = page.frameLocator('#searchIframe')
        const nextBtn = searchIframe.locator(`a.mBN2s[data-nclk-aid="${pageNum}"]`).first()
        if (await nextBtn.isVisible()) {
          await nextBtn.click()
          await sleep(2000)
          const pageShops = await extractShopsFromNaverMaps(page, keyword)
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
    errors.push(`Naver Maps crawl error: ${error instanceof Error ? error.message : error}`)
  } finally {
    await browser.close()
  }

  return { source: 'naver-maps', shops: allShops, errors, duration: Date.now() - start }
}

if (process.argv[1]?.endsWith('naver-maps.ts')) {
  const config = loadConfig()
  crawlNaverMaps(config)
    .then(result => {
      console.log(`[naver-maps] Done: ${result.shops.length} shops, ${result.errors.length} errors`)
    })
    .catch(err => {
      console.error('[naver-maps] Fatal:', err)
      process.exit(1)
    })
}
