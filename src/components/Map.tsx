import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { Shop } from '../types/shop'
import type { LatLngBounds } from 'leaflet'

const SEOUL_CENTER: [number, number] = [37.5665, 126.9780]
const DEFAULT_ZOOM = 11

function createMarkerIcon(highlighted: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="custom-marker${highlighted ? ' highlighted' : ''}">🧈</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

interface MapEventsProps {
  onBoundsChange: (bounds: LatLngBounds) => void
}

function MapEvents({ onBoundsChange }: MapEventsProps) {
  const map = useMapEvents({
    moveend: () => {
      onBoundsChange(map.getBounds())
    },
    load: () => {
      onBoundsChange(map.getBounds())
    },
  })

  useEffect(() => {
    onBoundsChange(map.getBounds())
  }, [map, onBoundsChange])

  return null
}

interface CenterOnShopProps {
  shop: Shop | null
}

function CenterOnShop({ shop }: CenterOnShopProps) {
  const map = useMap()

  useEffect(() => {
    if (shop && shop.lat !== null && shop.lng !== null) {
      map.setView([shop.lat, shop.lng], 15, { animate: true })
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
  return (
    <MapContainer
      center={SEOUL_CENTER}
      zoom={DEFAULT_ZOOM}
      className="h-full w-full"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents onBoundsChange={onBoundsChange} />
      <CenterOnShop shop={selectedShop} />

      {shops
        .filter(s => s.lat !== null && s.lng !== null)
        .map(shop => (
          <Marker
            key={shop.id}
            position={[shop.lat!, shop.lng!]}
            icon={createMarkerIcon(highlightedShopId === shop.id)}
            eventHandlers={{
              click: () => onMarkerClick(shop),
            }}
          />
        ))}
    </MapContainer>
  )
}
