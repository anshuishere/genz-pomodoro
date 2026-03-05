import type { Settings, ActiveTimer, DailyStats } from '../types';
import { STORAGE_KEYS, DEFAULT_SETTINGS, createDefaultDailyStats, getToday } from '../types';
import { logError } from './helpers';

/**
 * Get value from chrome storage
 */
export async function getStorageItem<T>(key: string): Promise<T | null> {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  } catch (error) {
    logError(`getStorageItem(${key})`, error);
    return null;
  }
}

/**
 * Set value in chrome storage
 */
export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    logError(`setStorageItem(${key})`, error);
    throw error;
  }
}

/**
 * Get settings
 */
export async function getSettings(): Promise<Settings> {
  const settings = await getStorageItem<Settings>(STORAGE_KEYS.SETTINGS);
  return settings ?? DEFAULT_SETTINGS;
}

/**
 * Save settings
 */
export async function saveSettings(settings: Settings): Promise<void> {
  return setStorageItem(STORAGE_KEYS.SETTINGS, settings);
}

/**
 * Get active timer
 */
export async function getActiveTimer(): Promise<ActiveTimer | null> {
  return getStorageItem<ActiveTimer>(STORAGE_KEYS.ACTIVE_TIMER);
}

/**
 * Save active timer
 */
export async function saveActiveTimer(timer: ActiveTimer | null): Promise<void> {
  return setStorageItem(STORAGE_KEYS.ACTIVE_TIMER, timer);
}

/**
 * Get history with auto-cleanup (keep only last 3 days)
 */
export async function getHistory(): Promise<{[date: string]: DailyStats}> {
  try {
    const history = await getStorageItem<{[date: string]: DailyStats}>(STORAGE_KEYS.HISTORY) ?? {};
    
    // Cleanup old entries
    const dates = Object.keys(history).sort().reverse();
    if (dates.length > 3) {
      const toDelete = dates.slice(3);
      toDelete.forEach(date => delete history[date]);
      await setStorageItem(STORAGE_KEYS.HISTORY, history);
    }
    
    return history;
  } catch (error) {
    logError('getHistory', error);
    return {};
  }
}

/**
 * Save history
 */
export async function saveHistory(history: {[date: string]: DailyStats}): Promise<void> {
  return setStorageItem(STORAGE_KEYS.HISTORY, history);
}

/**
 * Get current date tracker
 */
export async function getCurrentDate(): Promise<string> {
  return await getStorageItem<string>(STORAGE_KEYS.CURRENT_DATE) ?? getToday();
}

/**
 * Save current date tracker
 */
export async function saveCurrentDate(date: string): Promise<void> {
  return setStorageItem(STORAGE_KEYS.CURRENT_DATE, date);
}

/**
 * Check and handle daily reset
 */
export async function checkDailyReset(): Promise<void> {
  const today = getToday();
  const currentDate = await getCurrentDate();
  
  if (currentDate !== today) {
    // New day - update tracker
    await saveCurrentDate(today);
    
    // Ensure today exists in history
    const history = await getHistory();
    if (!history[today]) {
      history[today] = createDefaultDailyStats(today);
      await saveHistory(history);
    }
  }
}

/**
 * Get today's stats
 */
export async function getTodayStats(): Promise<DailyStats> {
  await checkDailyReset();
  const today = getToday();
  const history = await getHistory();
  return history[today] ?? createDefaultDailyStats(today);
}

/**
 * Update today's stats
 */
export async function updateTodayStats(stats: Partial<DailyStats>): Promise<void> {
  const today = getToday();
  const history = await getHistory();
  
  if (!history[today]) {
    history[today] = createDefaultDailyStats(today);
  }
  
  history[today] = { ...history[today], ...stats };
  await saveHistory(history);
}
