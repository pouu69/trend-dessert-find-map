import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { chromium } from 'playwright'
import type { RawShop } from './lib/types'
import { extractShopsFromBlogPost } from './lib/blog-extractor'
import { loadConfig, getDataDir, sleep } from './lib/utils'

const config = loadConfig()
const dataDir = getDataDir()

const keywordsPath = resolve(dataDir, 'keywords.json')
const keywords: string[] = JSON.parse(readFileSync(keywordsPath, 'utf-8'))

async function main() {
  console.log('[Stage 2] 네이버 블로그 크롤링')
  console.log(`  키워드 수: ${keywords.length}`)
  console.log(`  페이지/키워드: ${config.blogPages}`)
  console.log(`  최대 포스트/키워드: ${config.maxPostsPerKeyword}`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })

  const allShops: RawShop[] = []
  const visitedUrls = new Set<string>()

  try {
    for (let ki = 0; ki < keywords.length; ki++) {
      const keyword = keywords[ki]
      console.log(`  [${ki + 1}/${keywords.length}] "${keyword}"`)

      const blogUrls: string[] = []

      // Collect blog post URLs from search pages
      for (let pageNo = 1; pageNo <= config.blogPages; pageNo++) {
        const searchUrl = `https://section.blog.naver.com/Search/Post.naver?pageNo=${pageNo}&rangeType=ALL&orderBy=sim&keyword=${encodeURIComponent(keyword)}`

        const page = await context.newPage()
        try {
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
          await sleep(config.blogDelayMs)

          // Extract blog post links
          const links = await page.$$eval(
            'a.desc_inner[href*="blog.naver.com"]',
            (anchors: HTMLAnchorElement[]) => anchors.map(a => a.href)
          ).catch(() => [])

          for (const link of links) {
            if (!visitedUrls.has(link) && blogUrls.length < config.maxPostsPerKeyword) {
              visitedUrls.add(link)
              blogUrls.push(link)
            }
          }
        } catch (error) {
          console.error(`    검색 페이지 오류: ${error instanceof Error ? error.message : error}`)
        } finally {
          await page.close()
        }
      }

      console.log(`    블로그 포스트: ${blogUrls.length}개`)

      // Visit each blog post and extract shop info
      for (const blogUrl of blogUrls) {
        const page = await context.newPage()
        try {
          await page.goto(blogUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
          await sleep(config.blogDelayMs)

          const shops = await extractShopsFromBlogPost(page, keyword, blogUrl)
          if (shops.length > 0) {
            console.log(`    + ${shops.length}개 매장 발견: ${blogUrl}`)
            allShops.push(...shops)
          }
        } catch (error) {
          console.error(`    포스트 오류: ${error instanceof Error ? error.message : error}`)
        } finally {
          await page.close()
        }
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`  총 수집: ${allShops.length}개 매장`)

  const outputPath = resolve(dataDir, 'raw-shops.json')
  writeFileSync(outputPath, JSON.stringify(allShops, null, 2), 'utf-8')
  console.log(`  저장: ${outputPath}`)
  console.log('[Stage 2] 완료\n')
}

main().catch(err => {
  console.error('[Stage 2] 오류:', err)
  process.exit(1)
})
