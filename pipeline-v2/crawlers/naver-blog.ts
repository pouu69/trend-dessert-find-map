import { readFileSync } from 'fs'
import { resolve } from 'path'
import type { RawShop, PipelineConfig } from '../lib/types'
import { launchBrowser, safeGoto } from '../lib/browser'
import { extractShopsFromBlogPost } from '../lib/blog-extractor'
import { sleep, getDataDir, loadConfig } from '../lib/utils'

export interface BlogCrawlResult {
  readonly shops: RawShop[]
  readonly errors: string[]
  readonly duration: number
}

export async function crawlNaverBlog(config: PipelineConfig): Promise<BlogCrawlResult> {
  const start = Date.now()
  const errors: string[] = []
  const dataDir = getDataDir()

  const keywordsPath = resolve(dataDir, 'keywords.json')
  const keywords: string[] = JSON.parse(readFileSync(keywordsPath, 'utf-8'))

  console.log(`[naver-blog] ${keywords.length} keywords, ${config.blogPages} pages each`)

  const { browser, context } = await launchBrowser()
  const allShops: RawShop[] = []
  const visitedUrls = new Set<string>()

  try {
    for (let ki = 0; ki < keywords.length; ki++) {
      const keyword = keywords[ki]
      console.log(`  [${ki + 1}/${keywords.length}] "${keyword}"`)

      const blogUrls: string[] = []

      for (let pageNo = 1; pageNo <= config.blogPages; pageNo++) {
        const searchUrl = `https://section.blog.naver.com/Search/Post.naver?pageNo=${pageNo}&rangeType=ALL&orderBy=sim&keyword=${encodeURIComponent(keyword)}`

        const page = await context.newPage()
        try {
          const ok = await safeGoto(page, searchUrl)
          if (!ok) {
            errors.push(`Search page failed: ${keyword} page ${pageNo}`)
            continue
          }
          await sleep(config.blogDelayMs)

          const links = await page.$$eval(
            'a.desc_inner[href*="blog.naver.com"]',
            (anchors: HTMLAnchorElement[]) => anchors.map(a => a.href),
          ).catch(() => [])

          for (const link of links) {
            if (!visitedUrls.has(link) && blogUrls.length < config.maxPostsPerKeyword) {
              visitedUrls.add(link)
              blogUrls.push(link)
            }
          }
        } catch (error) {
          errors.push(`Search error: ${keyword} — ${error instanceof Error ? error.message : error}`)
        } finally {
          await page.close()
        }
      }

      for (const blogUrl of blogUrls) {
        const page = await context.newPage()
        try {
          const ok = await safeGoto(page, blogUrl)
          if (!ok) continue
          await sleep(config.blogDelayMs)

          const extracted = await extractShopsFromBlogPost(page, keyword, blogUrl)
          if (extracted.length > 0) {
            console.log(`    + ${extracted.length} shops from ${blogUrl}`)
            for (const shop of extracted) {
              allShops.push({
                name: shop.name,
                address: shop.address,
                phone: shop.phone,
                hours: shop.hours,
                category: shop.category,
                keyword: shop.keyword,
                blogUrl: shop.blogUrl,
                lat: shop.lat,
                lng: shop.lng,
                confidence: shop.confidence,
                extractionMethod: shop.extractionMethod,
              })
            }
          }
        } catch (error) {
          errors.push(`Blog error: ${blogUrl} — ${error instanceof Error ? error.message : error}`)
        } finally {
          await page.close()
        }
      }
    }
  } finally {
    await browser.close()
  }

  return { shops: allShops, errors, duration: Date.now() - start }
}

// CLI entrypoint
if (process.argv[1]?.endsWith('naver-blog.ts')) {
  const config = loadConfig()
  crawlNaverBlog(config)
    .then(result => {
      console.log(`[naver-blog] Done: ${result.shops.length} shops, ${result.errors.length} errors`)
    })
    .catch(err => {
      console.error('[naver-blog] Fatal:', err)
      process.exit(1)
    })
}
