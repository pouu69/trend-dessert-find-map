import { useState, useCallback, useEffect } from 'react'
import { TopBar } from './components/TopBar'
import { ShopPanel } from './components/ShopPanel'
import { DetailPanel } from './components/DetailPanel'
import { Map } from './components/Map'
import { Landing } from './components/Landing'
import { useShops } from './hooks/useShops'
import { useFavorites } from './hooks/useFavorites'
import type { Shop } from './types/shop'
import { products, getProductBySlug, type Product } from './data/products'
import './App.css'

function getProductFromPath(): Product | null {
  const path = window.location.pathname.replace(/^\//, '').replace(/\/$/, '')
  if (!path) return null
  return getProductBySlug(path) ?? null
}

function getShopIdFromHash(): string | null {
  const hash = window.location.hash.replace(/^#/, '')
  return hash || null
}

export default function App() {
  const [currentProduct, setCurrentProduct] = useState<Product | null>(getProductFromPath)
  const [selectedShopId, setSelectedShopId] = useState<string | null>(getShopIdFromHash)

  const {
    allShops,
    filteredShops,
    mappableShops,
    regions,
    searchQuery,
    setSearchQuery,
    selectedRegion,
    setSelectedRegion,
    setMapBounds,
  } = useShops(currentProduct?.dataFile ?? '')

  const { favoriteIds, toggleFavorite, isFavorite } = useFavorites()

  const [highlightedShopId, setHighlightedShopId] = useState<string | null>(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)

  const selectedShop = selectedShopId ? allShops.find(s => s.id === selectedShopId) ?? null : null

  useEffect(() => {
    function onPopState() {
      setCurrentProduct(getProductFromPath())
      setSelectedShopId(getShopIdFromHash())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    function onHashChange() {
      const shopId = getShopIdFromHash()
      setSelectedShopId(shopId)
      if (shopId) setHighlightedShopId(shopId)
      else setHighlightedShopId(null)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const displayedShops = showFavoritesOnly
    ? filteredShops.filter(s => favoriteIds.includes(s.id))
    : filteredShops

  const handleShopClick = useCallback((shop: Shop) => {
    window.location.hash = shop.id
  }, [])

  const handleShopHover = useCallback((shop: Shop) => {
    setHighlightedShopId(shop.id)
  }, [])

  const handleShopLeave = useCallback(() => {
    if (!selectedShop) setHighlightedShopId(null)
  }, [selectedShop])

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

  const handleProductChange = useCallback((product: Product) => {
    history.pushState(null, '', `/${product.slug}`)
    setCurrentProduct(product)
    setSelectedShopId(null)
    setHighlightedShopId(null)
    if (window.location.hash) {
      history.replaceState(null, '', `/${product.slug}`)
    }
  }, [])

  if (!currentProduct) {
    return <Landing onProductSelect={handleProductChange} />
  }

  return (
    <div className="h-[100dvh] w-screen relative overflow-hidden">
      <Map
        shops={mappableShops}
        highlightedShopId={highlightedShopId}
        selectedShop={selectedShop}
        onMarkerClick={handleMarkerClick}
        onBoundsChange={setMapBounds}
      />

      <TopBar
        currentProduct={currentProduct}
        products={products}
        onProductChange={handleProductChange}
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
        isFavorite={isFavorite}
        onToggleFavorite={toggleFavorite}
        onShopClick={handleShopClick}
        onShopHover={handleShopHover}
        onShopLeave={handleShopLeave}
      />

      {selectedShop && (
        <DetailPanel
          shop={selectedShop}
          isFavorite={isFavorite(selectedShop.id)}
          onToggleFavorite={toggleFavorite}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  )
}
