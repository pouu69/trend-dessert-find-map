import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const queries = [
  "달리당 수원본점 상하이버터떡",
  "연남허니밀크 상하이버터떡",
  "수아카롱 본점 수원 상하이버터떡",
  "코드91 강화도 카페",
  "모어커피랩 전주 카페",
  "브리나케오슈 제주 애월 베이커리",
  "위치앙베이커리 분당",
  "야탑버터떡카페 성남",
];

interface ShopResult {
  name: string;
  searchQuery: string;
  address: string;
  phone: string;
  hours: string;
  rating: string;
  lat: number | null;
  lng: number | null;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "ko-KR" });
  const page = await context.newPage();

  const results: ShopResult[] = [];

  for (const query of queries) {
    console.log(`\nSearching: ${query}`);
    const result: ShopResult = {
      name: "",
      searchQuery: query,
      address: "",
      phone: "",
      hours: "",
      rating: "",
      lat: null,
      lng: null,
    };

    try {
      const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await sleep(3000);

      // Handle consent dialog if present
      try {
        const consentBtn = await page.$('button[aria-label*="Accept"], button[aria-label*="동의"], form[action*="consent"] button');
        if (consentBtn) {
          await consentBtn.click();
          await sleep(2000);
        }
      } catch {}

      // Click first result if a list appears
      try {
        const firstLink = await page.$('a[href*="/maps/place/"]');
        if (firstLink) {
          const feedContainer = await page.$('div[role="feed"]');
          if (feedContainer) {
            console.log("  List detected, clicking first result...");
            await firstLink.click();
            await sleep(3000);
          }
        }
      } catch {}

      // Try to wait for URL to have coordinates
      try {
        await page.waitForURL(/@-?\d+\.\d+,-?\d+\.\d+/, { timeout: 5000 });
      } catch {
        // URL might not update, that's ok
      }

      // Extract name
      try {
        const h1 = await page.$("h1");
        if (h1) {
          result.name = (await h1.textContent()) || "";
        }
        if (!result.name) {
          const nameEl = await page.$(".DUwDvf");
          if (nameEl) result.name = (await nameEl.textContent()) || "";
        }
      } catch {}

      // Extract address
      try {
        const addrBtn = await page.$('[data-item-id="address"]');
        if (addrBtn) {
          const label = await addrBtn.getAttribute("aria-label");
          result.address = label?.replace(/^주소:\s*/, "") || "";
        }
        if (!result.address) {
          const btns = await page.$$("button[aria-label]");
          for (const btn of btns) {
            const label = await btn.getAttribute("aria-label");
            if (label && label.includes("주소")) {
              result.address = label.replace(/^주소:\s*/, "").trim();
              break;
            }
          }
        }
      } catch {}

      // Extract phone
      try {
        const phoneBtn = await page.$('[data-item-id^="phone:"]');
        if (phoneBtn) {
          const label = await phoneBtn.getAttribute("aria-label");
          if (label && !label.includes("휴대전화로")) {
            result.phone = label.replace(/^전화번호:\s*/, "").replace(/^전화:\s*/, "").trim();
          }
        }
        if (!result.phone) {
          const btns = await page.$$("button[aria-label]");
          for (const btn of btns) {
            const label = await btn.getAttribute("aria-label");
            if (label && label.includes("전화") && !label.includes("휴대전화로") && /\d{2,}/.test(label)) {
              result.phone = label.replace(/^전화번호:\s*/, "").replace(/^전화:\s*/, "").trim();
              break;
            }
          }
        }
      } catch {}

      // Extract hours
      try {
        const hoursEl = await page.$('[data-item-id="oh"]');
        if (hoursEl) {
          const label = await hoursEl.getAttribute("aria-label");
          if (label && label.length > 5 && label !== "영업시간") {
            result.hours = label;
          } else {
            const hoursText = await hoursEl.textContent();
            if (hoursText && hoursText.trim().length > 2) {
              result.hours = hoursText.trim();
            }
          }
        }
        if (!result.hours) {
          const els = await page.$$("[aria-label]");
          for (const el of els) {
            const label = await el.getAttribute("aria-label");
            if (label && label.includes("시간") && label.length > 10) {
              result.hours = label.trim();
              break;
            }
          }
        }
        if (!result.hours || result.hours === "영업시간") {
          const hoursTable = await page.$('.OqCZI, table.eK4R0e, [aria-label*="영업"]');
          if (hoursTable) {
            const text = await hoursTable.textContent();
            if (text && text.length > 5) result.hours = text.trim();
          }
        }
      } catch {}

      // Extract rating
      try {
        const ratingEl = await page.$(".MW4etd");
        if (ratingEl) {
          result.rating = (await ratingEl.textContent()) || "";
        }
        if (!result.rating) {
          const niceEl = await page.$(".F7nice span");
          if (niceEl) result.rating = (await niceEl.textContent()) || "";
        }
      } catch {}

      // Extract coordinates from URL
      try {
        const currentUrl = page.url();
        // Try @lat,lng pattern first
        let coordMatch = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordMatch) {
          result.lat = parseFloat(coordMatch[1]);
          result.lng = parseFloat(coordMatch[2]);
        }
        // Try !3d{lat}!4d{lng} pattern (Google Maps data URL format)
        if (!result.lat) {
          coordMatch = currentUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
          if (coordMatch) {
            result.lat = parseFloat(coordMatch[1]);
            result.lng = parseFloat(coordMatch[2]);
          }
        }
      } catch {}

      // If URL didn't have coords, try extracting from page source
      if (!result.lat) {
        try {
          const coords = await page.evaluate(() => {
            // Search through all page content for coordinate pairs
            // Google Maps embeds place data in page source with format like:
            // [lat, lng] or ,lat,lng, in various data structures
            const pageSource = document.documentElement.outerHTML;

            // Look for the place's coordinates in the Google Maps data
            // Pattern: often appears as ,[lat],[lng], in protobuf-like format
            // The place detail data usually has coords near the place name

            // Try to find coordinates in links first
            const links = document.querySelectorAll('a[href*="@"]');
            for (const link of links) {
              const href = link.getAttribute("href") || "";
              const m = href.match(/@(-?\d+\.\d{4,}),(-?\d+\.\d{4,})/);
              if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
            }

            // Look for image URLs that contain coordinates
            const imgs = document.querySelectorAll('img[src*="center="]');
            for (const img of imgs) {
              const src = img.getAttribute("src") || "";
              const m = src.match(/center=(-?\d+\.\d+)(?:%2C|,)(-?\d+\.\d+)/);
              if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
            }

            // Look for staticmap URLs
            const allImgs = document.querySelectorAll("img[src]");
            for (const img of allImgs) {
              const src = img.getAttribute("src") || "";
              if (src.includes("staticmap") || src.includes("maps")) {
                const m = src.match(/(-?3[3-8]\.\d{4,})[,%](-?1[2-3]\d\.\d{4,})/);
                if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
                const m2 = src.match(/(-?1[2-3]\d\.\d{4,})[,%](-?3[3-8]\.\d{4,})/);
                if (m2) return { lat: parseFloat(m2[2]), lng: parseFloat(m2[1]) };
              }
            }

            return null;
          });
          if (coords) {
            result.lat = coords.lat;
            result.lng = coords.lng;
          }
        } catch {}
      }

      // Last resort: use Geocoding via the address by looking at the directions link
      if (!result.lat) {
        try {
          const dirLink = await page.$('a[data-value="Directions"], a[aria-label*="길찾기"], a[href*="dir//"]');
          if (dirLink) {
            const href = await dirLink.getAttribute("href");
            if (href) {
              const m = href.match(/destination=(-?\d+\.\d+),(-?\d+\.\d+)/);
              if (m) {
                result.lat = parseFloat(m[1]);
                result.lng = parseFloat(m[2]);
              }
              const m2 = href.match(/dir\/\/(-?\d+\.\d+),(-?\d+\.\d+)/);
              if (!result.lat && m2) {
                result.lat = parseFloat(m2[1]);
                result.lng = parseFloat(m2[2]);
              }
            }
          }
        } catch {}
      }

      console.log(`  Found: ${result.name || "(no name)"} | ${result.address || "(no address)"} | ${result.lat},${result.lng}`);
    } catch (err) {
      console.error(`  Error searching "${query}":`, err);
    }

    results.push(result);
    await sleep(2000);
  }

  await browser.close();

  const outPath = join(__dirname, "gmap-batch1-results.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nResults saved to ${outPath}`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
