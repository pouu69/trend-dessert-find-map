import { resolve } from 'path'
import type { PipelineConfig, RawShop, StageResult } from './lib/types'
import { isGenericName, isDuplicate, loadConfig, getDataDir, saveJson, loadJson } from './lib/utils'

export async function runStage3(config: PipelineConfig): Promise<StageResult> {
  const start = Date.now()
  const dataDir = getDataDir()

  const rawShops = loadJson<RawShop[]>(resolve(dataDir, 'raw-shops.json'), [])

  console.log('[Stage 3] Data cleaning')
  console.log(`  Input: ${rawShops.length} shops`)

  const filtered = rawShops
    .filter(shop => !isGenericName(shop.name))
    .filter(shop => shop.name.trim().length > 0)
    .filter(shop => shop.address.trim().length > 0)

  console.log(`  After filters: ${filtered.length} shops`)

  const deduped: RawShop[] = []
  for (const shop of filtered) {
    const existingIndex = deduped.findIndex(existing => isDuplicate(existing, shop))
    if (existingIndex >= 0) {
      const existing = deduped[existingIndex]
      deduped[existingIndex] = {
        ...existing,
        phone: existing.phone || shop.phone,
        hours: existing.hours || shop.hours,
        category: existing.category || shop.category,
        address: shop.address.length > existing.address.length ? shop.address : existing.address,
      }
    } else {
      deduped.push({ ...shop })
    }
  }

  console.log(`  After dedup: ${deduped.length} shops`)

  const outputFile = resolve(dataDir, 'cleaned-shops.json')
  saveJson(outputFile, deduped)

  console.log('[Stage 3] Done\n')

  return {
    stage: 'stage3-clean',
    success: true,
    outputFile,
    itemCount: deduped.length,
    errors: [],
    duration: Date.now() - start,
  }
}

if (process.argv[1]?.endsWith('stage3-clean.ts')) {
  const config = loadConfig()
  runStage3(config).catch(err => {
    console.error('[Stage 3] Fatal:', err)
    process.exit(1)
  })
}
