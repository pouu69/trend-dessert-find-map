import { useState, useCallback } from 'react'
import { Header } from './components/Header'
import { SearchFilter } from './components/SearchFilter'
import { ShopList } from './components/ShopList'
import { ShopDetail } from './components/ShopDetail'
import { Map } from './components/Map'
import { useShops } from './hooks/useShops'
import { useFavorites } from './hooks/useFavorites'
import type { Shop } from './types/shop'
import './App.css'

export default function App() {
  const {
    filteredShops,
    mappableShops,
    regions,
    searchQuery,
    setSearchQuery,
    selectedRegion,
    setSelectedRegion,
    setMapBounds,
  } = useShops()

  const { favoriteIds, toggleFavorite, isFavorite } = useFavorites()

  const [highlightedShopId, setHighlightedShopId] = useState<string | null>(null)
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  const displayedShops = showFavoritesOnly
    ? filteredShops.filter(s => favoriteIds.includes(s.id))
    : filteredShops

  const handleShopClick = useCallback((shop: Shop) => {
    setSelectedShop(shop)
    setHighlightedShopId(shop.id)
  }, [])

  const handleShopHover = useCallback((shop: Shop) => {
    setHighlightedShopId(shop.id)
  }, [])

  const handleShopLeave = useCallback(() => {
    if (!selectedShop) setHighlightedShopId(null)
  }, [selectedShop])

  const handleMarkerClick = useCallback((shop: Shop) => {
    setHighlightedShopId(shop.id)
    setSelectedShop(shop)
  }, [])

  const handleBackToList = useCallback(() => {
    setSelectedShop(null)
    setHighlightedShopId(null)
  }, [])

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-[#F0F2F5]">
      {/* Map */}
      <Map
        shops={mappableShops}
        highlightedShopId={highlightedShopId}
        selectedShop={selectedShop}
        onMarkerClick={handleMarkerClick}
        onBoundsChange={setMapBounds}
      />

      {/* Side panel */}
      <aside
        className="
          anim-panel
          absolute top-3 left-3 bottom-3 w-[400px]
          flex flex-col
          bg-panel rounded-2xl
          shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)]
          border border-[rgba(0,0,0,0.06)]
          z-[1000] overflow-hidden
        "
      >
        <Header
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavorites={() => setShowFavoritesOnly(prev => !prev)}
          favoriteCount={favoriteIds.length}
          totalCount={filteredShops.length}
          visibleCount={displayedShops.length}
        />

        {selectedShop ? (
          <ShopDetail
            shop={selectedShop}
            isFavorite={isFavorite(selectedShop.id)}
            onToggleFavorite={toggleFavorite}
            onBack={handleBackToList}
          />
        ) : (
          <>
            <SearchFilter
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              regions={regions}
              selectedRegion={selectedRegion}
              onRegionChange={setSelectedRegion}
            />
            <ShopList
              shops={displayedShops}
              highlightedShopId={highlightedShopId}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              onShopClick={handleShopClick}
              onShopHover={handleShopHover}
              onShopLeave={handleShopLeave}
            />
          </>
        )}
      </aside>
    </div>
  )
}
