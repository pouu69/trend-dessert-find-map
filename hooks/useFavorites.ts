'use client'
import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'trendeat-favorites'

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setFavoriteIds(parsed)
      }
    } catch {
      // ignore
    }
  }, [])

  const toggleFavorite = useCallback((shopId: string) => {
    setFavoriteIds(prev => {
      const next = prev.includes(shopId)
        ? prev.filter(id => id !== shopId)
        : [...prev, shopId]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const isFavorite = useCallback(
    (shopId: string) => favoriteIds.includes(shopId),
    [favoriteIds]
  )

  return { favoriteIds, toggleFavorite, isFavorite }
}
