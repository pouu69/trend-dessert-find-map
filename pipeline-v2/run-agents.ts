/**
 * Agent Team Orchestration Interface
 *
 * This file defines the pipeline stages as discrete, dispatchable units
 * that Claude Code Agent Teams can invoke. Each stage is independent
 * and communicates via JSON files in pipeline-v2/data/.
 *
 * Usage by Claude Code:
 *   - Stage 1: Run inline (fast, <1 second)
 *   - Stage 2: Naver Blog crawling (discovery)
 *   - Stage 3: Data cleaning
 *   - Stage 4: Kakao Maps + Google Maps enrichment (parallel Agent Team)
 *   - Stage 5: Finalize
 *
 * Each function returns a StageResult with success/failure, item counts,
 * and error details for the coordinator to inspect.
 */

import { loadConfig } from './lib/utils'
import type { PipelineConfig, StageResult } from './lib/types'
import { runStage1 } from './stage1-keywords'
import { runStage2 } from './stage2-crawl'
import { runStage3 } from './stage3-clean'
import { runStage4 } from './stage4-enrich'
import { runStage5 } from './stage5-finalize'

export interface PipelineOrchestrator {
  readonly config: PipelineConfig
  runKeywords(): Promise<StageResult>
  runCrawl(): Promise<StageResult>
  runClean(): Promise<StageResult>
  runEnrich(): Promise<StageResult>
  runFinalize(): Promise<StageResult>
  runAll(): Promise<StageResult[]>
}

export function createOrchestrator(configOverrides?: Partial<PipelineConfig>): PipelineOrchestrator {
  const baseConfig = loadConfig()
  const config: PipelineConfig = { ...baseConfig, ...configOverrides }

  return {
    config,
    runKeywords: () => runStage1(config),
    runCrawl: () => runStage2(config),
    runClean: () => runStage3(config),
    runEnrich: () => runStage4(config),
    runFinalize: () => runStage5(config),

    async runAll(): Promise<StageResult[]> {
      const results: StageResult[] = []
      const stageFns = [runStage1, runStage2, runStage3, runStage4, runStage5]

      for (const fn of stageFns) {
        const result = await fn(config)
        results.push(result)
        if (!result.success) {
          console.error(`Pipeline stopped at ${result.stage}`)
          break
        }
      }

      return results
    },
  }
}

// CLI: run full pipeline via orchestrator
if (process.argv[1]?.endsWith('run-agents.ts')) {
  const orchestrator = createOrchestrator()
  orchestrator.runAll()
    .then(results => {
      const failed = results.find(r => !r.success)
      if (failed) {
        console.error(`\n❌ Pipeline failed at ${failed.stage}`)
        process.exit(1)
      }
      console.log('\n✅ Pipeline complete via orchestrator')
    })
    .catch(err => {
      console.error('Fatal:', err)
      process.exit(1)
    })
}
