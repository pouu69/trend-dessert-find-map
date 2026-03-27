import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export interface BrowserSession {
  readonly browser: Browser
  readonly context: BrowserContext
}

/** Launch a headless browser with Korean locale. Caller must close. */
export async function launchBrowser(): Promise<BrowserSession> {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    locale: 'ko-KR',
    userAgent: DEFAULT_USER_AGENT,
  })
  return { browser, context }
}

/**
 * Navigate to a URL safely. Uses 'domcontentloaded' — NEVER 'networkidle'.
 *
 * Why: Google Maps, Naver, Kakao all have long-polling/streaming connections
 * that prevent 'networkidle' from ever resolving. This caused hanging in
 * the original scripts/crawl-naver.ts and scripts/crawl-kakao.ts.
 */
export async function safeGoto(
  page: Page,
  url: string,
  options?: { timeout?: number },
): Promise<boolean> {
  const timeout = options?.timeout ?? 15000
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
    return true
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.warn(`[browser] Navigation failed: ${url} — ${msg}`)
    return false
  }
}

/**
 * Wait for a selector with fallback. Returns true if found, false if timeout.
 * Preferred over waitForLoadState('networkidle').
 */
export async function waitForSelector(
  page: Page,
  selector: string,
  timeout = 10000,
): Promise<boolean> {
  try {
    await page.locator(selector).first().waitFor({ timeout })
    return true
  } catch {
    return false
  }
}
