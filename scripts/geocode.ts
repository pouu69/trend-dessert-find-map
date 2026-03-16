interface NominatimResult {
  lat: string
  lon: string
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
      countrycodes: 'kr',
    })

    const res = await fetch(`${NOMINATIM_BASE}?${params}`, {
      headers: {
        'User-Agent': 'ShanghaiButterRiceMap/1.0',
      },
    })

    if (!res.ok) {
      console.warn(`[geocode] HTTP ${res.status} for: ${address}`)
      return null
    }

    const data: NominatimResult[] = await res.json()
    if (data.length === 0) {
      console.warn(`[geocode] No results for: ${address}`)
      return null
    }

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    }
  } catch (e) {
    console.warn(`[geocode] Failed for: ${address}`, e)
    return null
  }
}

export async function geocodeAll(
  addresses: string[]
): Promise<Map<string, { lat: number; lng: number } | null>> {
  const results = new Map<string, { lat: number; lng: number } | null>()

  for (const address of addresses) {
    if (results.has(address)) continue
    const result = await geocodeAddress(address)
    results.set(address, result)
    // Nominatim rate limit: 1 request per second
    await sleep(1100)
  }

  return results
}
