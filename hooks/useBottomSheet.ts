'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface BottomSheetConfig {
  snapPoints: readonly number[]
  initialSnap: number
  onClose?: () => void
  velocityCloseThreshold?: number
}

interface DragState {
  dragging: boolean
  startY: number
  startHeight: number
  startTime: number
}

export function closestSnap(ratio: number, snapPoints: readonly number[]): number {
  let best = snapPoints[0]
  let bestDist = Math.abs(ratio - best)
  for (const s of snapPoints) {
    const d = Math.abs(ratio - s)
    if (d < bestDist) {
      best = s
      bestDist = d
    }
  }
  return best
}

export function useBottomSheet({
  snapPoints,
  initialSnap,
  onClose,
  velocityCloseThreshold = 0.4,
}: BottomSheetConfig) {
  const [sheetHeight, setSheetHeight] = useState(initialSnap)
  const [viewportHeight, setViewportHeight] = useState(800)
  const [mounted, setMounted] = useState(false)
  const dragRef = useRef<DragState>({ dragging: false, startY: 0, startHeight: 0, startTime: 0 })

  const maxSnap = snapPoints[snapPoints.length - 1]
  const minSnap = snapPoints[0]

  useEffect(() => {
    setViewportHeight(window.innerHeight)
    setMounted(true)
    const handleResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleDragStart = useCallback((clientY: number) => {
    dragRef.current = { dragging: true, startY: clientY, startHeight: sheetHeight, startTime: Date.now() }
  }, [sheetHeight])

  const handleDragMove = useCallback((clientY: number) => {
    if (!dragRef.current.dragging) return
    const deltaY = dragRef.current.startY - clientY
    const deltaRatio = deltaY / viewportHeight
    const newHeight = Math.max(0, Math.min(maxSnap, dragRef.current.startHeight + deltaRatio))
    setSheetHeight(newHeight)
  }, [viewportHeight, maxSnap])

  const handleDragEnd = useCallback((clientY?: number) => {
    if (!dragRef.current.dragging) return
    dragRef.current.dragging = false

    if (clientY !== undefined && onClose) {
      const elapsed = Date.now() - dragRef.current.startTime
      const distancePx = clientY - dragRef.current.startY
      const velocity = distancePx / Math.max(elapsed, 1)
      if (velocity > velocityCloseThreshold) {
        onClose()
        return
      }
    }

    setSheetHeight(prev => {
      const snapped = closestSnap(prev, snapPoints)
      if (snapped <= minSnap && prev < minSnap * 0.5 && onClose) {
        setTimeout(() => onClose(), 0)
        return prev
      }
      return snapped
    })
  }, [onClose, snapPoints, minSnap, velocityCloseThreshold])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY)
  }, [handleDragStart])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY)
  }, [handleDragMove])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    handleDragEnd(e.changedTouches[0].clientY)
  }, [handleDragEnd])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    handleDragStart(e.clientY)
  }, [handleDragStart])

  useEffect(() => {
    if (!dragRef.current.dragging) return
    function onMove(e: MouseEvent) { handleDragMove(e.clientY) }
    function onUp(e: MouseEvent) { handleDragEnd(e.clientY) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  })

  const isDragging = dragRef.current.dragging
  const heightPx = Math.round(sheetHeight * viewportHeight)

  return {
    sheetHeight,
    setSheetHeight,
    heightPx,
    mounted,
    isDragging,
    dragHandleProps: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onMouseDown,
    },
  }
}
