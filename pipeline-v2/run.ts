import { loadConfig } from './lib/utils'
import { runStage1 } from './stage1-keywords'
import { runStage2 } from './stage2-crawl'
import { runStage3 } from './stage3-clean'
import { runStage4 } from './stage4-enrich'
import { runStage5 } from './stage5-finalize'
import type { StageResult } from './lib/types'

const config = loadConfig()

console.log(`\n========================================`)
console.log(`  Unified Data Pipeline v2`)
console.log(`  Product: ${config.product}`)
console.log(`  Discovery: Naver Blog → Enrichment: Kakao Maps + Google Maps`)
console.log(`========================================\n`)

const stages = [
  { name: 'Stage 1: Keywords', fn: runStage1 },
  { name: 'Stage 2: Crawl', fn: runStage2 },
  { name: 'Stage 3: Clean', fn: runStage3 },
  { name: 'Stage 4: Enrich', fn: runStage4 },
  { name: 'Stage 5: Finalize', fn: runStage5 },
]

const results: StageResult[] = []

for (const stage of stages) {
  console.log(`${'='.repeat(50)}`)
  console.log(`▶ ${stage.name}`)
  console.log(`${'='.repeat(50)}\n`)

  try {
    const result = await stage.fn(config)
    results.push(result)

    if (!result.success) {
      console.error(`\n❌ ${stage.name} failed`)
      result.errors.forEach(e => console.error(`  - ${e}`))
      process.exit(1)
    }
  } catch (error) {
    console.error(`\n❌ ${stage.name} fatal error`)
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Summary
console.log(`\n${'='.repeat(50)}`)
console.log(`✅ Pipeline complete!`)
console.log(`${'='.repeat(50)}`)
for (const r of results) {
  const secs = (r.duration / 1000).toFixed(1)
  const errTag = r.errors.length > 0 ? ` (${r.errors.length} errors)` : ''
  console.log(`  ${r.stage}: ${r.itemCount} items, ${secs}s${errTag}`)
}
console.log()
