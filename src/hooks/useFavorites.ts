import { useState, useCallback } from 'react'

const STORAGE_KEY = 'shanghai-butter-rice-favorites'

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    return []
  } catch {
    return []
  }
}

function saveFavorites(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(loadFavorites)

  const toggleFavorite = useCallback((shopId: string) => {
    setFavoriteIds(prev => {
      const next = prev.includes(shopId)
        ? prev.filter(id => id !== shopId)
        : [...prev, shopId]
      saveFavorites(next)
      return next
    })
  }, [])

  const isFavorite = useCallback(
    (shopId: string) => favoriteIds.includes(shopId),
    [favoriteIds]
  )

  return { favoriteIds, toggleFavorite, isFavorite }
}
