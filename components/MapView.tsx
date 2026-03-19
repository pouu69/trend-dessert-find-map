'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { TopBar } from './TopBar'
import { ShopPanel } from './ShopPanel'
import { DetailPanel } from './DetailPanel'
import { useShops } from '@/hooks/useShops'
import { useFavorites } from '@/hooks/useFavorites'
import { useIsMobile } from '@/hooks/useIsMobile'
import { products, type Product } from '@/data/products'
import type { Shop } from '@/types/shop'

const Map = dynamic(() => import('./Map').then(m => m.Map), { ssr: false })

function getShopIdFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.replace(/^#/, '')
  return hash || null
}

interface MapViewProps {
  product: Product
  initialShops: Shop[]
}

export function MapView({ product, initialShops }: MapViewProps) {
  const isMobile = useIsMobile()
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false)

  const {
    allShops,
    filteredShops,
    mappableShops,
    regions,
    searchQuery,
    setSearchQuery,
    selectedRegion,
    setSelectedRegion,
  } = useShops(initialShops)

  const { favoriteIds, toggleFavorite, isFavorite } = useFavorites()

  const [highlightedShopId, setHighlightedShopId] = useState<string | null>(null)
  const [scrollToShopId, setScrollToShopId] = useState<string | null>(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  const selectedShop = selectedShopId ? allShops.find(s => s.id === selectedShopId) ?? null : null

  // Listen for hash changes to select shops
  useEffect(() => {
    function onHashChange() {
      const shopId = getShopIdFromHash()
      setSelectedShopId(shopId)
      if (shopId) {
        setHighlightedShopId(shopId)
        setScrollToShopId(shopId)
      } else {
        setHighlightedShopId(null)
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Read hash on mount
  useEffect(() => {
    const shopId = getShopIdFromHash()
    if (shopId) {
      setSelectedShopId(shopId)
      setHighlightedShopId(shopId)
      setScrollToShopId(shopId)
    }
  }, [])

  const displayedShops = showFavoritesOnly
    ? filteredShops.filter(s => favoriteIds.includes(s.id))
    : filteredShops

  const handleShopClick = useCallback((shop: Shop) => {
    window.location.hash = shop.id
    if (isMobile) setMobileSheetExpanded(false)
  }, [isMobile])

  const handleShopHover = useCallback((shop: Shop) => {
    setHighlightedShopId(shop.id)
  }, [])

  const handleShopLeave = useCallback(() => {
    setHighlightedShopId(selectedShopId)
  }, [selectedShopId])

  const handleMarkerClick = useCallback((shop: Shop) => {
    window.location.hash = shop.id
  }, [])

  const handleCloseDetail = useCallback(() => {
    history.replaceState(null, '', window.location.pathname)
    setSelectedShopId(null)
    setHighlightedShopId(null)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectedShop) {
        handleCloseDetail()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedShop, handleCloseDetail])

  return (
    <div className="h-[100dvh] w-screen relative overflow-hidden">
      <Map
        shops={mappableShops}
        highlightedShopId={highlightedShopId}
        selectedShop={selectedShop}
        onMarkerClick={handleMarkerClick}
      />

      <TopBar
        currentProduct={product}
        products={products}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavorites={() => setShowFavoritesOnly(p => !p)}
        favoriteCount={favoriteIds.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        regions={regions}
        selectedRegion={selectedRegion}
        onRegionChange={setSelectedRegion}
        shops={allShops}
        onShopClick={handleShopClick}
      />

      <ShopPanel
        shops={displayedShops}
        highlightedShopId={highlightedShopId}
        scrollToShopId={scrollToShopId}
        onScrollComplete={() => setScrollToShopId(null)}
        isFavorite={isFavorite}
        onToggleFavorite={toggleFavorite}
        onShopClick={handleShopClick}
        onShopHover={handleShopHover}
        onShopLeave={handleShopLeave}
        isMobile={isMobile}
        expanded={mobileSheetExpanded}
        onToggleExpand={() => setMobileSheetExpanded(p => !p)}
        hasSelectedShop={!!selectedShop}
      />

      {selectedShop && (
        <DetailPanel
          shop={selectedShop}
          isFavorite={isFavorite(selectedShop.id)}
          onToggleFavorite={toggleFavorite}
          onClose={handleCloseDetail}
          isMobile={isMobile}
        />
      )}
    </div>
  )
}
