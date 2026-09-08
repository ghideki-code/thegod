import { TradeSignal, SystemNotification } from '../types';

/**
 * Web Audio API synthesizer for custom institutional market alert sounds.
 * Supports auto-unlock on user gesture, fallback synthesis, and explosive squeeze sirens.
 */

let audioCtx: AudioContext | null = null;
let isUnlocked = false;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => {
      isUnlocked = true;
    }).catch(() => {});
  } else if (audioCtx && audioCtx.state === 'running') {
    isUnlocked = true;
  }
  return audioCtx;
}

/**
 * Explicitly unlocks audio on any direct user click or gesture.
 */
export async function unlockAudio(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    isUnlocked = ctx.state === 'running';
    return isUnlocked;
  } catch (e) {
    console.warn('Audio unlock warning:', e);
    return false;
  }
}

export function isAudioUnlocked(): boolean {
  return isUnlocked || (!!audioCtx && audioCtx.state === 'running');
}

// Global auto-unlock listeners on ANY user interaction
if (typeof window !== 'undefined') {
  const autoUnlockHandler = () => {
    unlockAudio().catch(() => {});
  };
  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, autoUnlockHandler, { capture: true, passive: true });
  });
}

export type SoundToneId = 
  | 'EXPLOSION_SIREN'     // Ultra-loud emergency warble for 8%+ breakouts
  | 'CHIME_ASCENDING'     // Institutional Chime (D5 -> A5 -> D6)
  | 'BREAKOUT_ARPEGGIO'   // Energetic Breakout Arpeggio (C5 -> E5 -> G5 -> C6)
  | 'REVERSAL_DEEP'       // Deep Resonant Reversal Gong (A3 + E4 Warm Decay)
  | 'CONTINUATION_PULSE'  // Double Ping Pulse (E5 -> A5)
  | 'VOLATILITY_ALERT'    // Warning Staccato Ping (F#5 -> A5)
  | 'SOFT_PING'           // Soft Informative Bell (C5 gentle decay)
  | 'CYBER_RADAR'         // Precision Cyber Blip (B5 -> E6)
  | 'ZEN_MARIMBA'         // Ambient Triad Chord (A4 + C#5 + E5)
  | 'MUTE';               // Silencioso

export interface ToneOptionMetadata {
  id: SoundToneId;
  name: string;
  description: string;
  harmonicProfile: string;
  badge: string;
}

export const TONE_OPTIONS: ToneOptionMetadata[] = [
  {
    id: 'EXPLOSION_SIREN',
    name: 'Sirene de Explosão (Breakout 8%+)',
    description: 'Sirene alternada de alta potência para rompimentos explosivos e Squeeze',
    harmonicProfile: '880Hz / 1320Hz Alerta Pulsante (Sawtooth/Square)',
    badge: '🚨 Emergência',
  },
  {
    id: 'BREAKOUT_ARPEGGIO',
    name: 'Breakout Arpeggiado',
    description: 'Arpejo ascendente de 4 notas brilhantes e enérgicas',
    harmonicProfile: 'C5 - E5 - G5 - C6 (Sine/Triangle)',
    badge: 'Alta Energia',
  },
  {
    id: 'REVERSAL_DEEP',
    name: 'Ressonância de Reversão',
    description: 'Gongo institucional grave com sustentação harmônica',
    harmonicProfile: '220Hz + 440Hz com Decay Suave',
    badge: 'Institucional',
  },
  {
    id: 'CONTINUATION_PULSE',
    name: 'Pulso Duplo de Continuação',
    description: 'Dois pings rápidos e límpidos confirmando tendência',
    harmonicProfile: '659Hz -> 880Hz (Dual Ping)',
    badge: 'Confirmação',
  },
  {
    id: 'CHIME_ASCENDING',
    name: 'Chime Institucional',
    description: 'Chime ascendente em 3 tons estilo terminal de negociação',
    harmonicProfile: 'D5 -> A5 -> D6 (Triad Chime)',
    badge: 'Terminal Pro',
  },
  {
    id: 'VOLATILITY_ALERT',
    name: 'Alerta de Volatilidade',
    description: 'Tom de atenção estacado para stop hunts e choques macro',
    harmonicProfile: '740Hz -> 880Hz (Urgent Pulse)',
    badge: 'Atenção',
  },
  {
    id: 'CYBER_RADAR',
    name: 'Radar Cibernético',
    description: 'Blip sintético de alta definição para scanners e detecções',
    harmonicProfile: '987Hz -> 1318Hz (FM Blip)',
    badge: 'Tecnológico',
  },
  {
    id: 'SOFT_PING',
    name: 'Ping Suave Informativo',
    description: 'Sino delicado com decaimento suave para eventos discretos',
    harmonicProfile: '523Hz C5 (Soft Bell)',
    badge: 'Discreto',
  },
  {
    id: 'ZEN_MARIMBA',
    name: 'Harmonia Zen',
    description: 'Acorde tríade suave e relaxante para status e varreduras',
    harmonicProfile: '440Hz + 554Hz + 659Hz (Sine Triad)',
    badge: 'Suave',
  },
  {
    id: 'MUTE',
    name: 'Silencioso (Mudo)',
    description: 'Nenhum som emitido para esta categoria',
    harmonicProfile: 'Sem áudio',
    badge: 'Mudo',
  },
];

export interface SoundCategoryConfig {
  highPriorityTone: SoundToneId;
  infoTone: SoundToneId;
  enabled: boolean;
}

export interface AppAudioSettings {
  masterEnabled: boolean;
  masterVolume: number;         // 0.0 to 1.0
  highPriorityVolume: number;   // 0.0 to 1.0
  infoVolume: number;           // 0.0 to 1.0
  explosion: SoundCategoryConfig;
  breakout: SoundCategoryConfig;
  reversal: SoundCategoryConfig;
  continuation: SoundCategoryConfig;
  volatility: SoundCategoryConfig;
  systemStatus: SoundCategoryConfig;
}

export const DEFAULT_AUDIO_SETTINGS: AppAudioSettings = {
  masterEnabled: true,
  masterVolume: 0.85,
  highPriorityVolume: 1.0,
  infoVolume: 0.60,
  explosion: {
    highPriorityTone: 'EXPLOSION_SIREN',
    infoTone: 'VOLATILITY_ALERT',
    enabled: true,
  },
  breakout: {
    highPriorityTone: 'BREAKOUT_ARPEGGIO',
    infoTone: 'SOFT_PING',
    enabled: true,
  },
  reversal: {
    highPriorityTone: 'REVERSAL_DEEP',
    infoTone: 'CYBER_RADAR',
    enabled: true,
  },
  continuation: {
    highPriorityTone: 'CONTINUATION_PULSE',
    infoTone: 'SOFT_PING',
    enabled: true,
  },
  volatility: {
    highPriorityTone: 'VOLATILITY_ALERT',
    infoTone: 'SOFT_PING',
    enabled: true,
  },
  systemStatus: {
    highPriorityTone: 'CHIME_ASCENDING',
    infoTone: 'ZEN_MARIMBA',
    enabled: true,
  },
};

const STORAGE_KEY = 'god_protocol_audio_settings_v2';

export function getAudioSettings(): AppAudioSettings {
  if (typeof window === 'undefined') return DEFAULT_AUDIO_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AUDIO_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_AUDIO_SETTINGS,
      ...parsed,
      explosion: { ...DEFAULT_AUDIO_SETTINGS.explosion, ...(parsed.explosion || {}) },
      breakout: { ...DEFAULT_AUDIO_SETTINGS.breakout, ...(parsed.breakout || {}) },
      reversal: { ...DEFAULT_AUDIO_SETTINGS.reversal, ...(parsed.reversal || {}) },
      continuation: { ...DEFAULT_AUDIO_SETTINGS.continuation, ...(parsed.continuation || {}) },
      volatility: { ...DEFAULT_AUDIO_SETTINGS.volatility, ...(parsed.volatility || {}) },
      systemStatus: { ...DEFAULT_AUDIO_SETTINGS.systemStatus, ...(parsed.systemStatus || {}) },
    };
  } catch (e) {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

export function saveAudioSettings(settings: AppAudioSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save audio settings to localStorage:', e);
  }
}

export function resetAudioSettings(): AppAudioSettings {
  saveAudioSettings(DEFAULT_AUDIO_SETTINGS);
  return DEFAULT_AUDIO_SETTINGS;
}

/**
 * Native Web Audio API tone synthesis engine.
 * Uses linear ramps to avoid InvalidAccessError and ensure maximum volume & clarity.
 */
export function playTone(toneId: SoundToneId, volumeMultiplier: number = 1.0): void {
  if (toneId === 'MUTE') return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const baseVol = Math.max(0.05, Math.min(1.0, volumeMultiplier));
    const now = ctx.currentTime + 0.01;

    switch (toneId) {
      case 'EXPLOSION_SIREN': {
        // High-urgency alternating warble siren: 880Hz / 1320Hz / 1760Hz
        const pitches = [880, 1318.5, 880, 1318.5, 1046.5, 1760];
        pitches.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);

          gain.gain.setValueAtTime(0, now + idx * 0.08);
          gain.gain.linearRampToValueAtTime(0.42 * baseVol, now + idx * 0.08 + 0.015);
          gain.gain.linearRampToValueAtTime(0, now + idx * 0.08 + 0.075);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.08);
        });
        break;
      }

      case 'BREAKOUT_ARPEGGIO': {
        // Energetic 4-note ascending arpeggio: C5, E5, G5, C6
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + idx * 0.07);

          gain.gain.setValueAtTime(0, now + idx * 0.07);
          gain.gain.linearRampToValueAtTime(0.38 * baseVol, now + idx * 0.07 + 0.02);
          gain.gain.linearRampToValueAtTime(0, now + idx * 0.07 + 0.28);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.3);
        });
        break;
      }

      case 'REVERSAL_DEEP': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(220, now);
        osc1.frequency.linearRampToValueAtTime(196, now + 0.6);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(440, now);
        osc2.frequency.linearRampToValueAtTime(392, now + 0.6);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.40 * baseVol, now + 0.04);
        gain.gain.linearRampToValueAtTime(0, now + 0.75);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.8);
        osc2.stop(now + 0.8);
        break;
      }

      case 'CONTINUATION_PULSE': {
        const notes = [659.25, 880];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.12);

          gain.gain.setValueAtTime(0, now + i * 0.12);
          gain.gain.linearRampToValueAtTime(0.35 * baseVol, now + i * 0.12 + 0.02);
          gain.gain.linearRampToValueAtTime(0, now + i * 0.12 + 0.25);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.26);
        });
        break;
      }

      case 'CHIME_ASCENDING': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.linearRampToValueAtTime(880, now + 0.14);
        osc.frequency.linearRampToValueAtTime(1174.66, now + 0.32);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.38 * baseVol, now + 0.05);
        gain.gain.linearRampToValueAtTime(0, now + 0.65);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.65);
        break;
      }

      case 'VOLATILITY_ALERT': {
        const pings = [739.99, 880, 880];
        pings.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);

          gain.gain.setValueAtTime(0, now + idx * 0.08);
          gain.gain.linearRampToValueAtTime(0.32 * baseVol, now + idx * 0.08 + 0.01);
          gain.gain.linearRampToValueAtTime(0, now + idx * 0.08 + 0.12);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.14);
        });
        break;
      }

      case 'CYBER_RADAR': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.linearRampToValueAtTime(1318.51, now + 0.12);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.35 * baseVol, now + 0.02);
        gain.gain.linearRampToValueAtTime(0, now + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }

      case 'SOFT_PING': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.35 * baseVol, now + 0.02);
        gain.gain.linearRampToValueAtTime(0, now + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.45);
        break;
      }

      case 'ZEN_MARIMBA': {
        const chord = [440, 554.37, 659.25];
        chord.forEach((f) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.25 * baseVol, now + 0.03);
          gain.gain.linearRampToValueAtTime(0, now + 0.55);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.55);
        });
        break;
      }
    }
  } catch (e) {
    console.warn('Audio playback handled gracefully:', e);
  }
}

/**
 * Immediate audio verification function with direct context resume.
 */
export async function testAudioAlert(toneId: SoundToneId = 'EXPLOSION_SIREN'): Promise<boolean> {
  const unlocked = await unlockAudio();
  playTone(toneId, 1.0);
  return unlocked;
}

export function detectSignalSetupType(signal: TradeSignal): 'EXPLOSION' | 'BREAKOUT' | 'REVERSAL' | 'CONTINUATION' {
  // 1. Explosion & Squeeze detection
  if (
    signal.squeezeBreakout?.state === 'IGNICAO_DISPARADA' || 
    (signal.squeezeBreakout?.explosionScore || 0) >= 80 ||
    Math.abs(signal.change24h) >= 7.5
  ) {
    return 'EXPLOSION';
  }

  const mtfPattern = (signal.tripleScreen?.mtf?.pattern || '').toLowerCase();
  const mtfSR = signal.tripleScreen?.mtf?.dynamicSupportResistance;
  const sweepDetected = signal.fourPillars?.smc?.liquiditySweep?.detected;
  const wyckoffPhase = signal.fourPillars?.wyckoff?.currentPhase || '';
  const rsiStatus = signal.tripleScreen?.ltf?.rsiStatus || '';

  // 2. Breakout detection
  if (
    mtfSR === 'Rompida' ||
    mtfPattern.includes('romp') ||
    mtfPattern.includes('triâng') ||
    mtfPattern.includes('bandeira') ||
    Math.abs(signal.change24h) >= 4.5
  ) {
    return 'BREAKOUT';
  }

  // 3. Reversal detection
  if (
    sweepDetected ||
    mtfPattern.includes('duplo') ||
    mtfPattern.includes('ombro-cabeça') ||
    wyckoffPhase.includes('Spring') ||
    wyckoffPhase.includes('UTAD') ||
    rsiStatus.includes('Sobre')
  ) {
    return 'REVERSAL';
  }

  return 'CONTINUATION';
}

export function getSetupDetails(type: 'EXPLOSION' | 'BREAKOUT' | 'REVERSAL' | 'CONTINUATION'): {
  type: 'EXPLOSION' | 'BREAKOUT' | 'REVERSAL' | 'CONTINUATION';
  label: string;
  color: string;
} {
  switch (type) {
    case 'EXPLOSION':
      return {
        type: 'EXPLOSION',
        label: '🔥 Explosão 8%+ (Squeeze Fire)',
        color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      };
    case 'BREAKOUT':
      return {
        type: 'BREAKOUT',
        label: 'Breakout (Rompimento)',
        color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      };
    case 'REVERSAL':
      return {
        type: 'REVERSAL',
        label: 'Reversão (Sweep / Exaustão)',
        color: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      };
    case 'CONTINUATION':
    default:
      return {
        type: 'CONTINUATION',
        label: 'Continuação (Tendência / Pullback)',
        color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      };
  }
}

/**
 * Triggers customized sound alert for a TradeSignal according to user audio preferences.
 */
export function playSignalAudio(
  signal: TradeSignal,
  forcedPriority?: 'HIGH' | 'INFO',
  customSettings?: AppAudioSettings
): void {
  const settings = customSettings || getAudioSettings();
  if (!settings.masterEnabled) return;

  const isHighPriority = forcedPriority 
    ? forcedPriority === 'HIGH'
    : (signal.passedFilter || signal.confidence >= 75 || (signal.squeezeBreakout?.explosionScore || 0) >= 75);

  const setupType = detectSignalSetupType(signal);
  let categoryConfig: SoundCategoryConfig;

  if (setupType === 'EXPLOSION') {
    categoryConfig = settings.explosion;
  } else if (setupType === 'BREAKOUT') {
    categoryConfig = settings.breakout;
  } else if (setupType === 'REVERSAL') {
    categoryConfig = settings.reversal;
  } else {
    categoryConfig = settings.continuation;
  }

  if (!categoryConfig.enabled) return;

  const toneId = isHighPriority ? categoryConfig.highPriorityTone : categoryConfig.infoTone;
  const priorityVol = isHighPriority ? settings.highPriorityVolume : settings.infoVolume;
  const finalVolume = settings.masterVolume * priorityVol;

  playTone(toneId, finalVolume);
}

/**
 * Triggers sound alert for a SystemNotification according to user audio preferences.
 */
export function playNotificationAudio(
  notification: SystemNotification,
  customSettings?: AppAudioSettings
): void {
  const settings = customSettings || getAudioSettings();
  if (!settings.masterEnabled) return;

  const isHighPriority = notification.severity === 'high' || notification.type === 'CRITICAL_SIGNAL' || notification.type === 'SQUEEZE_BREAKOUT';
  let categoryConfig: SoundCategoryConfig = settings.systemStatus;

  if (notification.type === 'SQUEEZE_BREAKOUT' || notification.type === 'EXPLOSION_ALERT') {
    categoryConfig = settings.explosion;
  } else if (notification.type === 'VOLATILITY_SPIKE' || notification.type === 'FUNDING_ALERT') {
    categoryConfig = settings.volatility;
  } else if (notification.type === 'LIQUIDITY_SWEEP') {
    categoryConfig = settings.reversal;
  } else if (notification.type === 'CRITICAL_SIGNAL') {
    categoryConfig = settings.breakout;
  }

  if (!categoryConfig.enabled) return;

  const toneId = isHighPriority ? categoryConfig.highPriorityTone : categoryConfig.infoTone;
  const priorityVol = isHighPriority ? settings.highPriorityVolume : settings.infoVolume;
  const finalVolume = settings.masterVolume * priorityVol;

  playTone(toneId, finalVolume);
}

/**
 * Backwards-compatible shim for legacy calls.
 */
export function playSignalAlert(type: 'CRITICAL_SIGNAL' | 'ALERT' | 'BEEP' | 'EXPLOSION' = 'CRITICAL_SIGNAL'): void {
  const settings = getAudioSettings();
  if (!settings.masterEnabled) return;

  if (type === 'EXPLOSION') {
    playTone('EXPLOSION_SIREN', settings.masterVolume * settings.highPriorityVolume);
  } else if (type === 'CRITICAL_SIGNAL') {
    playTone(settings.breakout.highPriorityTone, settings.masterVolume * settings.highPriorityVolume);
  } else if (type === 'ALERT') {
    playTone(settings.volatility.highPriorityTone, settings.masterVolume * settings.highPriorityVolume);
  } else {
    playTone('SOFT_PING', settings.masterVolume * settings.infoVolume);
  }
}

export type TradeExecutionAlarmType = 'TRADE_TRIGGERED' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'NEAR_TRIGGER';

/**
 * Dedicated sound alarm synthesizer for trade execution events:
 * 1. Trade Acionado (Entrada preenchida)
 * 2. Take Profit Atingido (Alvo de lucro conquistado)
 * 3. Stop Loss Atingido (Proteção acionada)
 * 4. Perto de Acionar (Ativo na zona iminente do gatilho < 0.8%)
 */
export function playTradeLifecycleAlarm(type: TradeExecutionAlarmType, volumeMultiplier: number = 1.0): void {
  const settings = getAudioSettings();
  if (!settings.masterEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const baseVol = Math.max(0.1, Math.min(1.0, settings.masterVolume * volumeMultiplier));

  try {
    if (type === 'TRADE_TRIGGERED') {
      // Energetic double rising trigger tone (523Hz -> 784Hz) with crisp attack
      const frequencies = [523.25, 783.99];
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);

        gain.gain.setValueAtTime(0, now + idx * 0.09);
        gain.gain.linearRampToValueAtTime(0.42 * baseVol, now + idx * 0.09 + 0.02);
        gain.gain.linearRampToValueAtTime(0, now + idx * 0.09 + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.24);
      });
    } else if (type === 'TAKE_PROFIT') {
      // Triumphant quadruple arpeggio chord (C5 -> E5 -> G5 -> C6) with rich decay
      const chord = [523.25, 659.25, 783.99, 1046.50];
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.40 * baseVol, now + idx * 0.08 + 0.03);
        gain.gain.linearRampToValueAtTime(0, now + idx * 0.08 + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.48);
      });
    } else if (type === 'STOP_LOSS') {
      // Descending warning caution tone (440Hz -> 349Hz -> 261Hz)
      const warningPings = [440, 349.23, 261.63];
      warningPings.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.11);

        gain.gain.setValueAtTime(0, now + idx * 0.11);
        gain.gain.linearRampToValueAtTime(0.35 * baseVol, now + idx * 0.11 + 0.02);
        gain.gain.linearRampToValueAtTime(0, now + idx * 0.11 + 0.18);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.11);
        osc.stop(now + idx * 0.11 + 0.20);
      });
    } else if (type === 'NEAR_TRIGGER') {
      // Subtle radar proximity double-chirp (659.25Hz E5 -> 880Hz A5) for impending entry
      const radarPings = [659.25, 880.0];
      radarPings.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.28 * baseVol, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.11);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.12);
      });
    }
  } catch (e) {
    console.warn('Trade lifecycle alarm playback error:', e);
  }
}

