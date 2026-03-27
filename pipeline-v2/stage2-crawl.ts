import { resolve } from 'path'
import type { PipelineConfig, RawShop, StageResult } from './lib/types'
import { loadConfig, getDataDir, saveJson } from './lib/utils'
import { crawlNaverBlog } from './crawlers/naver-blog'

/**
 * Stage 2: Naver Blog Crawling (Discovery)
 *
 * Blog posts are the ONLY discovery source.
 * Map services (Kakao, Google) are used later for enrichment in Stage 4.
 */
export async function runStage2(config: PipelineConfig): Promise<StageResult> {
  const start = Date.now()
  const dataDir = getDataDir()

  console.log('[Stage 2] Naver Blog crawling (discovery)')
  console.log(`  Product: ${config.product}`)

  const result = await crawlNaverBlog(config).catch(err => {
    const msg = `Blog crawler failed: ${err instanceof Error ? err.message : err}`
    console.error(`  ${msg}`)
    return { shops: [] as RawShop[], errors: [msg], duration: 0 }
  })

  const allShops: RawShop[] = [...result.shops]
  console.log(`  Collected: ${allShops.length} shops, ${result.errors.length} errors`)

  if (allShops.length === 0) {
    console.error('[Stage 2] No shops discovered from blogs')
    return {
      stage: 'stage2-crawl',
      success: false,
      outputFile: '',
      itemCount: 0,
      errors: result.errors,
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
    errors: result.errors,
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
