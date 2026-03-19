'use client'
import { useState, useMemo } from 'react'
import type { Shop } from '@/types/shop'

export function useShops(initialShops: Shop[]) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  const allShops = initialShops

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

  const mappableShops = useMemo(() => {
    return filteredShops.filter(s => s.lat !== null && s.lng !== null)
  }, [filteredShops])

  return {
    allShops,
    filteredShops,
    mappableShops,
    regions,
    searchQuery,
    setSearchQuery,
    selectedRegion,
    setSelectedRegion,
  }
}
