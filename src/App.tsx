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
    visibleShops,
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
    ? visibleShops.filter(s => favoriteIds.includes(s.id))
    : visibleShops

  const handleShopClick = useCallback((shop: Shop) => {
    setSelectedShop(shop)
  }, [])

  const handleShopHover = useCallback((shop: Shop) => {
    setHighlightedShopId(shop.id)
  }, [])

  const handleShopLeave = useCallback(() => {
    setHighlightedShopId(null)
  }, [])

  const handleMarkerClick = useCallback((shop: Shop) => {
    setHighlightedShopId(shop.id)
    setSelectedShop(null)
  }, [])

  const handleBackToList = useCallback(() => {
    setSelectedShop(null)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-[#FAFAFA]">
      <Header
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavorites={() => setShowFavoritesOnly(prev => !prev)}
        favoriteCount={favoriteIds.length}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Side Panel */}
        <div className="w-[38%] flex flex-col bg-white border-r border-[#eee]">
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
        </div>

        {/* Map */}
        <div className="flex-1">
          <Map
            shops={mappableShops}
            highlightedShopId={highlightedShopId}
            selectedShop={selectedShop}
            onMarkerClick={handleMarkerClick}
            onBoundsChange={setMapBounds}
          />
        </div>
      </div>
    </div>
  )
}
