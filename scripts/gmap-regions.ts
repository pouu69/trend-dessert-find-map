import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const queries = [
  "미구제과 대구 달서구",
  "미구제과 대구 수성구 범어",
  "미구제과 대구 봉산",
  "미구제과 대구 중구 중앙대로",
  "미구제과 대구 동구",
  "몰레디저트카페 광주 동구",
  "몰레디저트카페 광주 광산구 수완",
  "몰레디저트카페 광주 서구",
  "몰레디저트카페 광주 북구",
  "몰레디저트카페 광주 남구",
  "브리나케오슈 제주 애월",
  "모어커피랩 전주",
  "겐츠베이커리 부산 부산진구",
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
        const consentBtn = await page.$(
          'button[aria-label*="Accept"], button[aria-label*="동의"], form[action*="consent"] button'
        );
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
            // Extract coords from the link href before clicking
            const href = await firstLink.getAttribute("href");
            if (href) {
              const hrefCoords = href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
              if (hrefCoords) {
                result.lat = parseFloat(hrefCoords[1]);
                result.lng = parseFloat(hrefCoords[2]);
              }
            }
            await firstLink.click();
            await sleep(4000);
          }
        }
      } catch {}

      // Extract name - try multiple selectors, skip generic "검색 결과"
      try {
        const nameEl = await page.$("h1.DUwDvf");
        if (nameEl) {
          const text = (await nameEl.textContent()) || "";
          if (text && text !== "검색 결과") result.name = text;
        }
        if (!result.name) {
          const h1 = await page.$("h1");
          if (h1) {
            const text = (await h1.textContent()) || "";
            if (text && text !== "검색 결과") result.name = text;
          }
        }
        if (!result.name) {
          // Try aria-label on the info panel
          const titleEl = await page.$('[data-item-id="title"]');
          if (titleEl) {
            const label = await titleEl.getAttribute("aria-label");
            if (label) result.name = label;
          }
        }
        // If still "검색 결과" or empty, wait a bit and retry
        if (!result.name || result.name === "검색 결과") {
          await sleep(2000);
          const h1 = await page.$("h1");
          if (h1) {
            const text = (await h1.textContent()) || "";
            if (text && text !== "검색 결과") result.name = text;
          }
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
        const phoneBtn = await page.$('[data-item-id^="phone"]');
        if (phoneBtn) {
          const label = await phoneBtn.getAttribute("aria-label");
          result.phone = label?.replace(/^전화번호:\s*/, "") || "";
        }
        if (!result.phone) {
          const btns = await page.$$("button[aria-label]");
          for (const btn of btns) {
            const label = await btn.getAttribute("aria-label");
            if (label && label.includes("전화")) {
              result.phone = label.replace(/^전화번호:\s*/, "").trim();
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
          result.hours = label || "";
        }
        if (!result.hours) {
          const els = await page.$$("[aria-label]");
          for (const el of els) {
            const label = await el.getAttribute("aria-label");
            if (label && (label.includes("시간") || label.includes("영업"))) {
              result.hours = label.trim();
              break;
            }
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
        // Wait a moment for URL to update with coordinates
        await sleep(1000);
        const currentUrl = page.url();
        const coordMatch = currentUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordMatch) {
          result.lat = parseFloat(coordMatch[1]);
          result.lng = parseFloat(coordMatch[2]);
        }
        // Try from !3d !4d parameters in URL
        if (result.lat === null) {
          const lat3d = currentUrl.match(/!3d(-?\d+\.\d+)/);
          const lng4d = currentUrl.match(/!4d(-?\d+\.\d+)/);
          if (lat3d && lng4d) {
            result.lat = parseFloat(lat3d[1]);
            result.lng = parseFloat(lng4d[1]);
          }
        }
        // Try from og:image or other meta
        if (result.lat === null) {
          const coords = await page.evaluate(() => {
            const meta = document.querySelector('meta[content*="center="]');
            if (meta) {
              const match = meta.getAttribute("content")?.match(/center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/);
              if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
            }
            // Try from links with coordinates
            const links = Array.from(document.querySelectorAll('a[href*="/@"]'));
            for (const link of links) {
              const href = link.getAttribute("href") || "";
              const m = href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
              if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
            }
            return null;
          });
          if (coords) {
            result.lat = coords.lat;
            result.lng = coords.lng;
          }
        }
      } catch {}

      console.log(
        `  Found: ${result.name || "(no name)"} | ${result.address || "(no address)"} | ${result.lat},${result.lng}`
      );
    } catch (err) {
      console.error(`  Error searching "${query}":`, err);
    }

    results.push(result);
    await sleep(2000);
  }

  await browser.close();

  const outPath = join(__dirname, "gmap-regions-results.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n=== Results Summary ===`);
  console.log(`Total searched: ${results.length}`);
  console.log(`With name: ${results.filter((r) => r.name).length}`);
  console.log(`With address: ${results.filter((r) => r.address).length}`);
  console.log(`With coordinates: ${results.filter((r) => r.lat !== null).length}`);
  console.log(`\nResults saved to ${outPath}`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
