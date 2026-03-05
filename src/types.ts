/**
 * TrueFocus - Simplified Types
 */

export type TimerState = 'idle' | 'running' | 'paused' | 'completed';
export type TimerMode = 'focus' | 'break';

/**
 * Session record for history tracking
 */
export interface SessionRecord {
  id: string;
  mode: TimerMode;
  startTime: number;
  endTime: number;
  duration: number;
  plannedDuration: number;
  completed: boolean;
}

/**
 * Daily statistics
 */
export interface DailyStats {
  date: string;
  totalFocusTime: number;
  totalBreakTime: number;
  sessionsCompleted: number;
  sessions: SessionRecord[];
}

/**
 * Active timer state
 */
export interface ActiveTimer {
  state: TimerState;
  mode: TimerMode;
  timeRemaining: number;
  totalTime: number;
  startTime: number;
  endTime?: number;
  pausedAt: number | null;
  sessionId: string;
}

/**
 * Simplified settings
 */
export interface Settings {
  focusDuration: number;
  breakDuration: number;
  notifications: boolean;
  testMode: boolean;
}

/**
 * Main storage structure
 */
export interface ExtensionData {
  activeTimer: ActiveTimer | null;
  history: { [date: string]: DailyStats };
  currentDate: string;
  settings: Settings;
}

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  ACTIVE_TIMER: 'activeTimer',
  HISTORY: 'history',
  CURRENT_DATE: 'currentDate',
  SETTINGS: 'settings',
} as const;

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: Settings = {
  focusDuration: 1500,
  breakDuration: 300,
  notifications: true,
  testMode: false,
};

/**
 * Default daily stats
 */
export function createDefaultDailyStats(date: string): DailyStats {
  return {
    date,
    totalFocusTime: 0,
    totalBreakTime: 0,
    sessionsCompleted: 0,
    sessions: [],
  };
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Format seconds as MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format seconds as "1h 15m" or "5m"
 */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Log error with context
 */
export function logError(context: string, error: unknown): void {
  console.error(`[TrueFocus] ${context}:`, error);
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
