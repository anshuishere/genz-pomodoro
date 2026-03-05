import type { TimerMode, Settings, DailyStats, SessionRecord, ActiveTimer } from '../types';
import { formatTime, formatDuration, getToday, generateId, createDefaultDailyStats } from '../types';
import { 
  getSettings, 
  saveActiveTimer, 
  getActiveTimer, 
  getHistory, 
  saveHistory,
  getTodayStats,
  updateTodayStats
} from '../utils/storage';

const ALARM_NAME = 'truefocus-timer';

/**
 * Initialize the background service worker
 */
export async function initializeBackground(): Promise<void> {
  // Ensure today's stats exist
  const todayStats = await getTodayStats();
  // eslint-disable-next-line no-console
  console.log('[TrueFocus] Initialized. Today:', todayStats.date);
}

/**
 * Start a new focus session
 */
export async function startFocus(): Promise<void> {
  console.log('[TrueFocus] Starting focus session');
  const settings = await getSettings();
  const sessionId = generateId();
  const now = Date.now();

  const timer: ActiveTimer = {
    state: 'running',
    mode: 'focus',
    timeRemaining: settings.focusDuration,
    totalTime: settings.focusDuration,
    startTime: now,
    pausedAt: null,
    sessionId,
  };

  await saveActiveTimer(timer);
  await createAlarm();
  console.log('[TrueFocus] Focus session started');
}

/**
 * Start a new break session
 */
export async function startBreak(): Promise<void> {
  console.log('[TrueFocus] Starting break session');
  const settings = await getSettings();
  const sessionId = generateId();
  const now = Date.now();
  
  const timer: ActiveTimer = {
    state: 'running',
    mode: 'break',
    timeRemaining: settings.breakDuration,
    totalTime: settings.breakDuration,
    startTime: now,
    pausedAt: null,
    sessionId,
  };
  
  await saveActiveTimer(timer);
  await createAlarm();
}

/**
 * Pause the current timer
 */
export async function pauseTimer(): Promise<void> {
  const timer = await getActiveTimer();
  if (!timer || timer.state !== 'running') return;
  
  timer.state = 'paused';
  timer.pausedAt = Date.now();
  await saveActiveTimer(timer);
  await clearAlarm();
}

/**
 * Resume the paused timer
 */
export async function resumeTimer(): Promise<void> {
  const timer = await getActiveTimer();
  if (!timer || timer.state !== 'paused') return;
  
  timer.state = 'running';
  timer.pausedAt = null;
  await saveActiveTimer(timer);
  await createAlarm();
}

/**
 * Stop/cancel the current timer
 */
export async function stopTimer(): Promise<void> {
  await clearAlarm();
  await saveActiveTimer(null);
}

/**
 * Skip the current timer and move to next phase
 */
export async function skipTimer(): Promise<void> {
  const timer = await getActiveTimer();
  if (!timer || timer.state === 'idle') return;
  
  const settings = await getSettings();
  
  // Mark current as incomplete and save
  const now = Date.now();
  const today = getToday();
  const session: SessionRecord = {
    id: timer.sessionId,
    mode: timer.mode,
    startTime: timer.startTime,
    endTime: now,
    duration: timer.totalTime - timer.timeRemaining,
    plannedDuration: timer.totalTime,
    completed: false, // Marked as skipped
  };
  
  // Update history for partial time
  const history = await getHistory();
  if (!history[today]) {
    history[today] = createDefaultDailyStats(today);
  }
  
  // Only count time actually spent, don't increment session counter for skips
  if (timer.mode === 'focus') {
    history[today].totalFocusTime += session.duration;
  } else {
    history[today].totalBreakTime += session.duration;
  }
  history[today].sessions.push(session);
  
  await saveHistory(history);
  await clearAlarm();
  
  // Start next phase immediately
  const newSessionId = generateId();
  const newMode: TimerMode = timer.mode === 'focus' ? 'break' : 'focus';
  const newDuration = newMode === 'focus' ? settings.focusDuration : settings.breakDuration;
  
  const newTimer: ActiveTimer = {
    state: 'running',
    mode: newMode,
    timeRemaining: newDuration,
    totalTime: newDuration,
    startTime: now,
    pausedAt: null,
    sessionId: newSessionId,
  };
  
  await saveActiveTimer(newTimer);
  await createAlarm();
}

/**
 * Handle timer completion
 */
export async function completeTimer(timer: ActiveTimer): Promise<void> {
  const now = Date.now();
  const today = getToday();
  
  // Create session record
  const session: SessionRecord = {
    id: timer.sessionId,
    mode: timer.mode,
    startTime: timer.startTime,
    endTime: now,
    duration: timer.totalTime - timer.timeRemaining,
    plannedDuration: timer.totalTime,
    completed: true,
  };
  
  // Update history
  const history = await getHistory();
  if (!history[today]) {
    history[today] = createDefaultDailyStats(today);
  }
  
  // Update time totals
  if (timer.mode === 'focus') {
    history[today].totalFocusTime += session.duration;
  } else {
    history[today].totalBreakTime += session.duration;
  }
  
  history[today].sessionsCompleted++;
  history[today].sessions.push(session);
  
  await saveHistory(history);
  
  // Mark timer as completed
  timer.state = 'completed';
  timer.timeRemaining = 0;
  timer.endTime = now;
  await saveActiveTimer(timer);
  
  // Clear badge
  await chrome.action.setBadgeText({ text: '' });
  
  // Show notification
  const settings = await getSettings();
  if (settings.notifications) {
    await showCompletionNotification(timer.mode);
  }
  
  // Auto-open popup
  try {
    // Small delay to ensure state is saved first
    await new Promise(resolve => setTimeout(resolve, 100));
    await chrome.action.openPopup();
    console.log('[TrueFocus] Popup opened successfully');
  } catch (error) {
    // Popup auto-open requires Chrome 127+
    console.error('[TrueFocus] Failed to open popup:', error);
  }
}

/**
 * Handle timer tick (every second)
 */
export async function handleTimerTick(): Promise<void> {
  const timer = await getActiveTimer();
  if (!timer || timer.state !== 'running') {
    console.log('[TrueFocus] Timer tick skipped - not running');
    // Clear alarm if no active timer to prevent continuous firing
    await clearAlarm();
    return;
  }
  
  timer.timeRemaining--;
  console.log(`[TrueFocus] Timer tick: ${timer.timeRemaining}s remaining`);
  
  if (timer.timeRemaining <= 0) {
    console.log('[TrueFocus] Timer completed!');
    await completeTimer(timer);
  } else {
    await saveActiveTimer(timer);
    await updateBadge(timer);
  }
}

/**
 * Show completion notification
 */
async function showCompletionNotification(mode: TimerMode): Promise<void> {
  try {
    const title = mode === 'focus' 
      ? 'Focus Complete! 🎉'
      : "Break's Over! 💪";
    
    const message = mode === 'focus'
      ? 'Great job! Take a 5-minute break?'
      : 'Ready to focus for 25 minutes?';
    
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
      priority: 2,
    });
    console.log('[TrueFocus] Notification shown');
  } catch (error) {
    console.error('[TrueFocus] Failed to show notification:', error);
  }
}

/**
 * Update extension badge
 */
async function updateBadge(timer: ActiveTimer): Promise<void> {
  if (timer.state !== 'running') {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  
  const minutes = Math.ceil(timer.timeRemaining / 60);
  const text = minutes > 99 ? '99+' : minutes.toString();
  
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ 
    color: timer.mode === 'focus' ? '#6366f1' : '#10b981'
  });
}

/**
 * Create timer alarm
 */
async function createAlarm(): Promise<void> {
  console.log('[TrueFocus] Creating alarm');
  await chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 / 60 });
  console.log('[TrueFocus] Alarm created');
}

/**
 * Clear timer alarm
 */
async function clearAlarm(): Promise<void> {
  console.log('[TrueFocus] Clearing alarm');
  await chrome.alarms.clear(ALARM_NAME);
}

/**
 * Get current timer status
 */
export async function getTimerStatus(): Promise<ActiveTimer | null> {
  return getActiveTimer();
}

/**
 * Get today's statistics
 */
export async function getTodayStatistics(): Promise<DailyStats> {
  return getTodayStats();
}

export { formatTime, formatDuration };
