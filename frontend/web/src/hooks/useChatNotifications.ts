import { useCallback } from 'react'
import { usePreferences } from '../context/PreferencesContext'

let audioCtx: AudioContext | null = null

function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioConstructor = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioConstructor) return null
  if (!audioCtx) {
    audioCtx = new AudioConstructor()
  }
  return audioCtx
}

function playTone(freq: number) {
  const ctx = ensureAudioContext()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.value = freq
  osc.connect(gain)
  gain.connect(ctx.destination)

  const now = ctx.currentTime
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)

  osc.start(now)
  osc.stop(now + 0.22)
}

export function useChatNotifications() {
  const { prefs } = usePreferences()

  const playSend = useCallback(() => {
    if (!prefs.notificationsEnabled || !prefs.playSendSound) return
    playTone(720)
  }, [prefs.notificationsEnabled, prefs.playSendSound])

  const playReceive = useCallback(() => {
    if (!prefs.notificationsEnabled || !prefs.playReceiveSound) return
    playTone(440)
  }, [prefs.notificationsEnabled, prefs.playReceiveSound])

  return {
    playSend,
    playReceive,
  }
}
