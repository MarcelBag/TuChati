//frontend/web/src/components/Chat/VoiceMessage.tsx

import * as React from 'react'

const BAR_COUNT = 60
const MIN_BAR_HEIGHT = 0.12
const FALLBACK_PEAKS = new Array(BAR_COUNT).fill(0).map((_, index) => {
  const phase = index / Math.max(BAR_COUNT - 1, 1)
  return 0.25 + 0.35 * Math.sin(phase * Math.PI)
})

type ExtractResult = {
  peaks: number[]
  duration: number
}

async function extractPeaks(src: string, signal: AbortSignal): Promise<ExtractResult> {
  let requestUrl = src
  let credentials: RequestCredentials = 'same-origin'
  if (typeof window !== 'undefined') {
    try {
      const resolved = new URL(src, window.location.href)
      requestUrl = resolved.toString()
      credentials = resolved.origin === window.location.origin ? 'include' : 'omit'
    } catch {
      credentials = 'omit'
    }
  }

  const response = await fetch(requestUrl, { credentials, signal })
  if (!response.ok) {
    throw new Error('Failed to fetch audio source')
  }

  const arrayBuffer = await response.arrayBuffer()
  const audioCtx = new AudioContext()

  try {
    const buffer = await audioCtx.decodeAudioData(arrayBuffer)
    const sliceLength = Math.floor(buffer.length / BAR_COUNT) || 1
    const peaks = new Array<number>(BAR_COUNT).fill(0)

    for (let bar = 0; bar < BAR_COUNT; bar += 1) {
      const start = bar * sliceLength
      const end = Math.min(start + sliceLength, buffer.length)
      let sumSquare = 0
      let sampleCount = 0

      for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
        const channel = buffer.getChannelData(channelIndex)
        for (let idx = start; idx < end; idx += 1) {
          const value = channel[idx]
          sumSquare += value * value
          sampleCount += 1
        }
      }

      if (sampleCount === 0) {
        peaks[bar] = MIN_BAR_HEIGHT
        continue
      }

      const rms = Math.sqrt(sumSquare / sampleCount)
      peaks[bar] = Math.min(Math.max(rms * 2.6, MIN_BAR_HEIGHT), 1)
    }

    return { peaks, duration: buffer.duration }
  } finally {
    audioCtx.close().catch(() => {})
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const totalSeconds = Math.max(Math.round(seconds), 0)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export type VoiceMessageProps = {
  src: string
  durationSeconds?: number | null
}

export function VoiceMessage({ src, durationSeconds }: VoiceMessageProps) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const [peaks, setPeaks] = React.useState<number[]>(FALLBACK_PEAKS)
  const [duration, setDuration] = React.useState<number | null>(
    typeof durationSeconds === 'number' ? durationSeconds : null,
  )
  const [currentTime, setCurrentTime] = React.useState(0)
  const [loadingWave, setLoadingWave] = React.useState(true)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [hadError, setHadError] = React.useState(false)

  const normalizedPeaks = React.useMemo(() => {
    const max = Math.max(...peaks)
    if (!Number.isFinite(max) || max <= 0) return FALLBACK_PEAKS
    return peaks.map((value) => Math.max(value / max, MIN_BAR_HEIGHT))
  }, [peaks])

  const displayPeaks = React.useMemo(() => {
    const bucketed = normalizedPeaks.map((value) => Number(value.toFixed(3)))
    const unique = new Set(bucketed).size
    if (unique <= 2) {
      const count = normalizedPeaks.length
      return normalizedPeaks.map((_, index) => {
        const phase = index / Math.max(count - 1, 1)
        const synthetic = 0.35 + 0.55 * Math.sin(phase * Math.PI)
        return Math.max(synthetic, MIN_BAR_HEIGHT)
      })
    }
    return normalizedPeaks
  }, [normalizedPeaks])

  const progressRatio = React.useMemo(() => {
    if (!duration || !Number.isFinite(duration) || duration <= 0) return 0
    return Math.min(Math.max(currentTime / duration, 0), 1)
  }, [currentTime, duration])

  const activeIndex = React.useMemo(() => {
    if (progressRatio <= 0) return -1
    return Math.floor(progressRatio * displayPeaks.length)
  }, [displayPeaks.length, progressRatio])

  const stopRaf = React.useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const tick = React.useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(audio.currentTime)
    if (!audio.paused && !audio.ended) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      stopRaf()
    }
  }, [stopRaf])

  const togglePlayback = React.useCallback(() => {
    const audio = audioRef.current
    if (!audio || hadError) return
    if (audio.paused) {
      audio.play().catch(() => setHadError(true))
    } else {
      audio.pause()
    }
  }, [hadError])

  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined

    const handlePlay = () => {
      setIsPlaying(true)
      tick()
    }
    const handlePause = () => {
      setIsPlaying(false)
      setCurrentTime(audio.currentTime)
      stopRaf()
    }
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(audio.duration || 0)
      stopRaf()
      audio.currentTime = 0
    }
    const handleLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration((prev) => (prev && prev > 0 ? prev : audio.duration))
      }
    }
    const handleError = () => {
      setHadError(true)
      setIsPlaying(false)
      stopRaf()
    }
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('loadedmetadata', handleLoaded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('loadedmetadata', handleLoaded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      stopRaf()
    }
  }, [stopRaf, tick])

  React.useEffect(() => {
    let mounted = true
    if (!src) return undefined

    setLoadingWave(true)
    setHadError(false)
    setCurrentTime(0)
    stopRaf()

    const controller = new AbortController()

    extractPeaks(src, controller.signal)
      .then(({ peaks: nextPeaks, duration: nextDuration }) => {
        if (!mounted) return
        setPeaks(nextPeaks)
        setDuration((prev) => (prev && prev > 0 ? prev : nextDuration))
      })
      .catch(() => {
        if (!mounted) return
        setPeaks(FALLBACK_PEAKS)
      })
      .finally(() => {
        if (mounted) setLoadingWave(false)
      })

    return () => {
      mounted = false
      controller.abort()
    }
  }, [src, stopRaf])

  React.useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setIsPlaying(false)
  }, [src])

  const displayTime = React.useMemo(() => {
    if (isPlaying) return formatTime(currentTime)
    if (duration) return formatTime(duration)
    return '0:00'
  }, [currentTime, duration, isPlaying])

  return (
    <div className={`voice-message${isPlaying ? ' playing' : ''}${hadError ? ' error' : ''}`}>
      <button
        type="button"
        className="voice-control"
        onClick={togglePlayback}
        disabled={hadError}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        <span aria-hidden>
          {hadError ? '⚠️' : isPlaying ? '❚❚' : '▶'}
        </span>
      </button>

      <div className="voice-body">
        <div className={`voice-wave${loadingWave ? ' loading' : ''}`} aria-hidden>
          {displayPeaks.map((value, index) => {
            const active = index <= activeIndex
            return (
              <span
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                className={`voice-wave-bar${active ? ' active' : ''}`}
                style={{ '--bar-scale': value } as React.CSSProperties}
              />
            )
          })}
        </div>
        <div className="voice-meta">
          <span className="voice-time">{displayTime}</span>
          <a className="voice-download" href={src} download>
            Download
          </a>
        </div>
      </div>

      <audio ref={audioRef} preload="metadata" src={src} crossOrigin="anonymous" />
    </div>
  )
}

export default VoiceMessage
