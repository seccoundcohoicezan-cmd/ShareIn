'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * Autoplay that runs only while the element is on screen and the visitor has not
 * asked for reduced motion. `stop()` switches to manual mode (e.g. when a step bar is clicked).
 */
export function useAutoplay<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [auto, setAuto] = useState(true)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) setAuto(false)
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return setVisible(true)
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, playing: auto && visible, auto, stop: () => setAuto(false), resume: () => setAuto(true) }
}
