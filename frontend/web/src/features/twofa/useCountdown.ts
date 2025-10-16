import { useEffect, useRef, useState } from 'react'

function format(seconds: number) {
  const safe = Math.max(0, seconds | 0)
  const mm = Math.floor(safe / 60)
  const ss = (safe % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

export function useCountdown(seconds: number, active: boolean, resetKey?: unknown) {
  const [remaining, setRemaining] = useState(seconds)
  const activeRef = useRef(active)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    setRemaining(seconds)
  }, [seconds, resetKey])

  useEffect(() => {
    if (!activeRef.current || seconds <= 0) return
    if (remaining <= 0) return

    const timer = window.setInterval(() => {
      setRemaining((prev) => {
        if (!activeRef.current) return prev
        if (prev <= 1) {
          window.clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [active, remaining, seconds])

  return {
    remaining,
    formatted: format(remaining),
    isExpired: remaining <= 0,
  }
}
