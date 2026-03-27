/** Pipeline configuration — loaded from pipeline.config.json, overridable via CLI */
export interface PipelineConfig {
  readonly product: string
  readonly searchPatterns: readonly string[]
  readonly cities: readonly string[]
  readonly blogPages: number
  readonly maxPostsPerKeyword: number
  readonly googleMapsDelayMs: number
  readonly kakaoMapsDelayMs: number
  readonly blogDelayMs: number
  readonly nominatimDelayMs: number
  readonly outputPath: string
  readonly dataDir: string
}

/** Raw shop data discovered from blog posts */
export interface RawShop {
  readonly name: string
  readonly address: string
  readonly phone: string
  readonly hours: string
  readonly category: string
  readonly keyword: string
  readonly blogUrl: string
  readonly lat: number | null
  readonly lng: number | null
  readonly confidence: number
  readonly extractionMethod: string
}

/** Shop enriched with map services data (Kakao Maps, Google Maps, Nominatim) */
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
  readonly enrichedBy: string // 'kakao-maps' | 'google-maps' | 'nominatim' | 'blog-coords'
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

/** Stage execution result for agent coordination */
export interface StageResult {
  readonly stage: string
  readonly success: boolean
  readonly outputFile: string
  readonly itemCount: number
  readonly errors: readonly string[]
  readonly duration: number
}
