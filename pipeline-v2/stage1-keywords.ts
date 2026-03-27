import { resolve } from 'path'
import type { PipelineConfig, StageResult } from './lib/types'
import { loadConfig, getDataDir, saveJson } from './lib/utils'

export async function runStage1(config: PipelineConfig): Promise<StageResult> {
  const start = Date.now()
  const dataDir = getDataDir()

  console.log('[Stage 1] Keyword generation')
  console.log(`  Product: ${config.product}`)

  const keywords: string[] = []

  for (const pattern of config.searchPatterns) {
    if (pattern.includes('{city}')) {
      for (const city of config.cities) {
        keywords.push(
          pattern.replace('{product}', config.product).replace('{city}', city),
        )
      }
    } else {
      keywords.push(pattern.replace('{product}', config.product))
    }
  }

  const unique = [...new Set(keywords)]
  const outputFile = resolve(dataDir, 'keywords.json')
  saveJson(outputFile, unique)

  console.log(`  Generated: ${unique.length} keywords`)
  console.log('[Stage 1] Done\n')

  return {
    stage: 'stage1-keywords',
    success: true,
    outputFile,
    itemCount: unique.length,
    errors: [],
    duration: Date.now() - start,
  }
}

if (process.argv[1]?.endsWith('stage1-keywords.ts')) {
  const config = loadConfig()
  runStage1(config).catch(err => {
    console.error('[Stage 1] Fatal:', err)
    process.exit(1)
  })
}
