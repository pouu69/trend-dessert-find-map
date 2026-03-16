import { useState, useMemo, useCallback } from 'react'
import type { Shop } from '../types/shop'
import shopsData from '../data/shops.json'
import type { LatLngBounds } from 'leaflet'

export function useShops() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [mapBounds, setMapBounds] = useState<LatLngBounds | null>(null)

  const allShops: Shop[] = shopsData as Shop[]

  const regions = useMemo(() => {
    const uniqueRegions = [...new Set(allShops.map(s => s.region))]
    return uniqueRegions.sort()
  }, [allShops])

  const filteredShops = useMemo(() => {
    let result = allShops
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        s => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q)
      )
    }
    if (selectedRegion) {
      result = result.filter(s => s.region === selectedRegion)
    }
    return result
  }, [allShops, searchQuery, selectedRegion])

  const visibleShops = useMemo(() => {
    if (!mapBounds) return filteredShops
    return filteredShops.filter(s => {
      if (s.lat === null || s.lng === null) return false
      return mapBounds.contains([s.lat, s.lng])
    })
  }, [filteredShops, mapBounds])

  const mappableShops = useMemo(() => {
    return filteredShops.filter(s => s.lat !== null && s.lng !== null)
  }, [filteredShops])

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setSelectedRegion(null)
  }, [])

  return {
    allShops,
    filteredShops,
    visibleShops,
    mappableShops,
    regions,
    searchQuery,
    setSearchQuery,
    selectedRegion,
    setSelectedRegion,
    mapBounds,
    setMapBounds,
    clearFilters,
  }
}
