const soundCache = new Map<string, HTMLAudioElement>();

type SoundType = 'success' | 'error' | 'warning' | 'info' | 'search-start' | 'search-complete' | 'payment';

const soundMap: Record<SoundType, string> = {
  success: '/sounds/success.webm',
  error: '/sounds/error.webm',
  warning: '/sounds/warning.webm',
  info: '/sounds/info.webm',
  'search-start': '/sounds/search-start.webm',
  'search-complete': '/sounds/search-complete.webm',
  payment: '/sounds/payment.webm',
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getAudio(type: SoundType): HTMLAudioElement | null {
  if (soundCache.has(type)) {
    return soundCache.get(type)!;
  }
  const url = soundMap[type];
  if (!url) return null;
  try {
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = 0.5;
    soundCache.set(type, audio);
    return audio;
  } catch {
    return null;
  }
}

export function playSound(type: SoundType): void {
  if (prefersReducedMotion()) return;
  const audio = getAudio(type);
  if (!audio) return;
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // Autoplay was prevented; ignore silently
    });
  }
}

export function preloadSounds(): void {
  if (prefersReducedMotion()) return;
  (Object.keys(soundMap) as SoundType[]).forEach((type) => getAudio(type));
}