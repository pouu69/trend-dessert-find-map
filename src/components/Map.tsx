import { useEffect, useRef, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { Shop } from '../types/shop'
import type { LatLngBounds } from 'leaflet'

const SEOUL_CENTER: [number, number] = [37.5665, 126.9780]
const DEFAULT_ZOOM = 11

function createMarkerIcon(highlighted: boolean) {
  const color = highlighted ? '#FF6B2C' : '#E8804A'
  const size = highlighted ? 38 : 32

  return L.divIcon({
    className: '',
    html: `<div class="pin${highlighted ? ' is-active' : ''}">
      ${highlighted ? '<div class="pin__pulse"></div>' : ''}
      <svg class="pin__body" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 0C7.611 0 0 7.611 0 17c0 12.5 15.5 25.5 16.3 26.2a1 1 0 001.4 0C18.5 42.5 34 29.5 34 17 34 7.611 26.389 0 17 0z" fill="${color}"/>
        <circle cx="17" cy="16" r="7" fill="white"/>
        <circle cx="17" cy="16" r="3" fill="${color}"/>
      </svg>
    </div>`,
    iconSize: [size, size + 10],
    iconAnchor: [size / 2, size + 10],
  })
}

interface MapEventsProps {
  onBoundsChange: (bounds: LatLngBounds) => void
}

function MapEvents({ onBoundsChange, onViewportChange }: MapEventsProps & { onViewportChange: (bounds: LatLngBounds) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds()
      onBoundsChange(b)
      onViewportChange(b)
    },
    load: () => {
      const b = map.getBounds()
      onBoundsChange(b)
      onViewportChange(b)
    },
  })

  useEffect(() => {
    const b = map.getBounds()
    onBoundsChange(b)
    onViewportChange(b)
  }, [map, onBoundsChange, onViewportChange])

  return null
}

function FlyToShop({ shop }: { shop: Shop | null }) {
  const map = useMap()
  const prevShopId = useRef<string | null>(null)

  useEffect(() => {
    if (shop?.lat != null && shop?.lng != null && shop.id !== prevShopId.current) {
      prevShopId.current = shop.id
      map.flyTo([shop.lat, shop.lng], 15, { duration: 0.8 })
    }
    if (!shop) {
      prevShopId.current = null
    }
  }, [shop, map])

  return null
}

interface MapProps {
  shops: Shop[]
  highlightedShopId: string | null
  selectedShop: Shop | null
  onMarkerClick: (shop: Shop) => void
  onBoundsChange: (bounds: LatLngBounds) => void
}

export function Map({
  shops,
  highlightedShopId,
  selectedShop,
  onMarkerClick,
  onBoundsChange,
}: MapProps) {
  const [viewport, setViewport] = useState<LatLngBounds | null>(null)

  const viewportShops = useMemo(() => {
    const geoShops = shops.filter(s => s.lat !== null && s.lng !== null)
    if (!viewport) return geoShops
    // Pad bounds slightly so pins at edges don't pop in/out abruptly
    const padded = viewport.pad(0.1)
    return geoShops.filter(s => padded.contains([s.lat!, s.lng!]))
  }, [shops, viewport])

  return (
    <MapContainer
      center={SEOUL_CENTER}
      zoom={DEFAULT_ZOOM}
      className="h-full w-full"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <MapEvents onBoundsChange={onBoundsChange} onViewportChange={setViewport} />
      <FlyToShop shop={selectedShop} />

      {viewportShops.map(shop => (
          <Marker
            key={shop.id}
            position={[shop.lat!, shop.lng!]}
            icon={createMarkerIcon(highlightedShopId === shop.id)}
            eventHandlers={{
              click: () => onMarkerClick(shop),
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -45]}
              opacity={1}
              className="shop-tooltip"
            >
              <span style={{ fontWeight: 700, fontSize: 13 }}>{shop.name}</span>
              {shop.priceRange && (
                <span style={{ color: '#9CA3AF', marginLeft: 6, fontSize: 11 }}>
                  {shop.priceRange}원
                </span>
              )}
            </Tooltip>
          </Marker>
        ))}
    </MapContainer>
  )
}
