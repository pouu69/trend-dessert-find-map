/** Pipeline configuration — loaded from pipeline.config.json, overridable via CLI */
export interface PipelineConfig {
  readonly product: string
  readonly searchPatterns: readonly string[]
  readonly cities: readonly string[]
  readonly sources: readonly CrawlSource[]
  readonly blogPages: number
  readonly maxPostsPerKeyword: number
  readonly googleMapsDelayMs: number
  readonly blogDelayMs: number
  readonly nominatimDelayMs: number
  readonly outputPath: string
  readonly dataDir: string
}

/** Available crawl sources — each maps to a crawler module */
export type CrawlSource = 'naver-blog' | 'naver-maps' | 'kakao-maps'

/** Raw shop data extracted by any crawler */
export interface RawShop {
  readonly name: string
  readonly address: string
  readonly phone: string
  readonly hours: string
  readonly category: string
  readonly source: CrawlSource
  readonly keyword: string
  readonly blogUrl: string
}

/** Shop enriched with Google Maps / Nominatim data */
export interface EnrichedShop {
  readonly name: string
  readonly address: string
  readonly phone: string
  readonly hours: string
  readonly category: string
  readonly rating: string
  readonly reviewCount: string
  readonly lat: number | null
  readonly lng: number | null
  readonly description: string
  readonly source: CrawlSource
}

/** Final shop schema — matches types/shop.ts for frontend consumption */
export interface Shop {
  id: string
  readonly name: string
  readonly address: string
  readonly lat: number | null
  readonly lng: number | null
  readonly phone: string
  readonly hours: string
  readonly closedDays: readonly string[]
  readonly priceRange: string
  readonly tags: readonly string[]
  readonly description: string
  readonly region: string
}

/** Result of a single crawler run */
export interface CrawlResult {
  readonly source: CrawlSource
  readonly shops: readonly RawShop[]
  readonly errors: readonly string[]
  readonly duration: number
}

/** Stage execution result for agent coordination */
export interface StageResult {
  readonly stage: string
  readonly success: boolean
  readonly outputFile: string
  readonly itemCount: number
  readonly errors: readonly string[]
  readonly duration: number
}
