//frontend/web/src/api/VoiceMessages.tsx

import * as React from 'react'

const BAR_COUNT = 60
const CANVAS_HEIGHT = 60
const CANVAS_WIDTH = 260

function drawWave(canvas: HTMLCanvasElement, peaks: number[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx || peaks.length === 0) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const centerY = canvas.height / 2
  const barWidth = canvas.width / peaks.length
  let color = '#3b82f6'
  if (typeof window !== 'undefined') {
    const computed = getComputedStyle(document.documentElement).getPropertyValue('--wave-color')
    color = computed?.trim() || color
  }
  ctx.fillStyle = color

  peaks.forEach((value, index) => {
    const height = value * centerY
    const x = index * barWidth
    ctx.fillRect(x, centerY - height, barWidth * 0.6, height * 2 || 2)
  })
}

async function extractPeaks(src: string, signal: AbortSignal): Promise<number[]> {
  const res = await fetch(src, { credentials: 'include', signal })
  const arrayBuffer = await res.arrayBuffer()
  const audioCtx = new AudioContext()
  try {
    const buffer = await audioCtx.decodeAudioData(arrayBuffer)
    const channel = buffer.getChannelData(0)
    const sliceLength = Math.floor(channel.length / BAR_COUNT) || 1
    const peaks: number[] = new Array(BAR_COUNT).fill(0)

    for (let i = 0; i < BAR_COUNT; i += 1) {
      const start = i * sliceLength
      let sum = 0
      for (let j = 0; j < sliceLength && start + j < channel.length; j += 1) {
        sum += Math.abs(channel[start + j])
      }
      peaks[i] = Math.min(sum / sliceLength, 1)
    }

    return peaks
  } finally {
    audioCtx.close().catch(() => {})
  }
}

export function VoiceMessage({ src }: { src: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !src) return undefined

    const controller = new AbortController()
    extractPeaks(src, controller.signal)
      .then((peaks) => {
        if (controller.signal.aborted) return
        drawWave(canvas, peaks)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          // fallback: draw flat baseline
          drawWave(canvas, new Array(BAR_COUNT).fill(0.05))
        }
      })

    return () => {
      controller.abort()
    }
  }, [src])

  return (
    <div className="voice-message">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        aria-hidden
        className="voice-wave"
      />
      <audio
        controls
        preload="metadata"
        src={src}
        className="voice-audio"
      />
    </div>
  )
}

export default VoiceMessage
