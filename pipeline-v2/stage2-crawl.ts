import { resolve } from 'path'
import type { PipelineConfig, RawShop, CrawlResult, StageResult } from './lib/types'
import { loadConfig, getDataDir, saveJson } from './lib/utils'
import { crawlNaverBlog } from './crawlers/naver-blog'
import { crawlNaverMaps } from './crawlers/naver-maps'
import { crawlKakaoMaps } from './crawlers/kakao-maps'

const CRAWLER_MAP = {
  'naver-blog': crawlNaverBlog,
  'naver-maps': crawlNaverMaps,
  'kakao-maps': crawlKakaoMaps,
} as const

export async function runStage2(config: PipelineConfig): Promise<StageResult> {
  const start = Date.now()
  const dataDir = getDataDir()
  const allErrors: string[] = []

  console.log('[Stage 2] Multi-source crawling')
  console.log(`  Sources: ${config.sources.join(', ')}`)

  const crawlerPromises = config.sources.map(source => {
    const crawlerFn = CRAWLER_MAP[source]
    if (!crawlerFn) {
      console.warn(`  Unknown source: ${source} — skipping`)
      return Promise.resolve({
        source,
        shops: [],
        errors: [`Unknown source: ${source}`],
        duration: 0,
      } as CrawlResult)
    }

    return crawlerFn(config).catch((err): CrawlResult => {
      const msg = `${source} crawler failed: ${err instanceof Error ? err.message : err}`
      console.error(`  ${msg}`)
      return { source, shops: [], errors: [msg], duration: 0 }
    })
  })

  const results = await Promise.all(crawlerPromises)

  const allShops: RawShop[] = []
  for (const result of results) {
    console.log(`  ${result.source}: ${result.shops.length} shops, ${result.errors.length} errors`)
    allShops.push(...result.shops)
    allErrors.push(...result.errors)
  }

  if (allShops.length === 0) {
    console.error('[Stage 2] No shops collected from any source')
    return {
      stage: 'stage2-crawl',
      success: false,
      outputFile: '',
      itemCount: 0,
      errors: allErrors,
      duration: Date.now() - start,
    }
  }

  const outputFile = resolve(dataDir, 'raw-shops.json')
  saveJson(outputFile, allShops)

  console.log(`  Total: ${allShops.length} raw shops`)
  console.log('[Stage 2] Done\n')

  return {
    stage: 'stage2-crawl',
    success: true,
    outputFile,
    itemCount: allShops.length,
    errors: allErrors,
    duration: Date.now() - start,
  }
}

if (process.argv[1]?.endsWith('stage2-crawl.ts')) {
  const config = loadConfig()
  runStage2(config).catch(err => {
    console.error('[Stage 2] Fatal:', err)
    process.exit(1)
  })
}
