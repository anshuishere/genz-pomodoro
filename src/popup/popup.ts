import type { ActiveTimer, Settings, DailyStats, TimerState, TimerMode } from '../types';
import { formatTime, formatDuration, DEFAULT_SETTINGS } from '../types';
import { getSettings, saveSettings } from '../utils/storage';

// State
let currentTimer: ActiveTimer | null = null;
let currentSettings: Settings = DEFAULT_SETTINGS;
let currentStats: DailyStats | null = null;
let timerInterval: number | null = null;

// DOM Elements
const elements = {
  timerTime: document.getElementById('timer-time') as HTMLSpanElement,
  timerMode: document.getElementById('timer-mode') as HTMLSpanElement,
  actionBtn: document.getElementById('action-btn') as HTMLButtonElement,
  skipBtn: document.getElementById('skip-btn') as HTMLButtonElement,
  statusMessage: document.getElementById('status-message') as HTMLDivElement,
  sessionCount: document.getElementById('session-count') as HTMLSpanElement,
  totalTime: document.getElementById('total-time') as HTMLSpanElement,
  settingsBtn: document.getElementById('settings-btn') as HTMLButtonElement,
  settingsModal: document.getElementById('settings-modal') as HTMLDivElement,
  closeSettingsBtn: document.getElementById('close-settings') as HTMLButtonElement,
  settingsForm: document.getElementById('settings-form') as HTMLFormElement,
};

/**
 * Initialize popup
 */
async function initialize(): Promise<void> {
  setupEventListeners();
  await loadSettings();
  await loadTimerStatus();
  await loadTodayStats();
  startUIRefresh();
}

/**
 * Setup event listeners
 */
function setupEventListeners(): void {
  elements.actionBtn.addEventListener('click', handleActionButton);
  elements.skipBtn.addEventListener('click', handleSkip);
  elements.settingsBtn.addEventListener('click', openSettings);
  elements.closeSettingsBtn.addEventListener('click', closeSettings);
  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) closeSettings();
  });
  elements.settingsForm.addEventListener('submit', handleSettingsSubmit);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      handleActionButton();
    } else if (e.code === 'Escape') {
      closeSettings();
    }
  });
}

/**
 * Handle the main action button based on current state
 */
async function handleActionButton(): Promise<void> {
  if (!currentTimer || currentTimer.state === 'idle') {
    // Start focus
    await sendMessage('startFocus');
  } else if (currentTimer.state === 'running') {
    // Pause
    await sendMessage('pauseTimer');
  } else if (currentTimer.state === 'paused') {
    // Resume
    await sendMessage('resumeTimer');
  } else if (currentTimer.state === 'completed') {
    // Start next phase
    if (currentTimer.mode === 'focus') {
      await sendMessage('startBreak');
    } else {
      await sendMessage('startFocus');
    }
  }
  
  await loadTimerStatus();
  await loadTodayStats();
}

/**
 * Handle skip button - skip current timer and go to next phase
 */
async function handleSkip(): Promise<void> {
  if (!currentTimer || currentTimer.state === 'idle') return;
  
  await sendMessage('skipTimer');
  await loadTimerStatus();
  await loadTodayStats();
}

/**
 * Load timer status from background
 */
async function loadTimerStatus(): Promise<void> {
  const response = await sendMessage('getTimerStatus');
  if (response.success) {
    currentTimer = response.data as ActiveTimer;
  } else {
    currentTimer = null;
  }
  updateUI();
}

/**
 * Load today's statistics
 */
async function loadTodayStats(): Promise<void> {
  const response = await sendMessage('getTodayStats');
  if (response.success) {
    currentStats = response.data as DailyStats;
    updateStats();
  }
}

/**
 * Load settings
 */
async function loadSettings(): Promise<void> {
  currentSettings = await getSettings();
  
  // Update form
  const form = elements.settingsForm;
  (form.elements.namedItem('focusDuration') as HTMLInputElement).value = 
    String(Math.floor(currentSettings.focusDuration / 60));
  (form.elements.namedItem('breakDuration') as HTMLInputElement).value = 
    String(Math.floor(currentSettings.breakDuration / 60));
  (form.elements.namedItem('notifications') as HTMLInputElement).checked = 
    currentSettings.notifications;
  (form.elements.namedItem('testMode') as HTMLInputElement).checked = 
    currentSettings.testMode;
}

/**
 * Update UI based on current state
 */
function updateUI(): void {
  if (!currentTimer || currentTimer.state === 'idle') {
    // Idle state
    elements.timerTime.textContent = formatTime(currentSettings.focusDuration);
    elements.timerMode.textContent = 'Ready to Focus';
    elements.actionBtn.textContent = 'Start Focus';
    elements.statusMessage.style.display = 'none';
    elements.skipBtn.style.display = 'none';
  } else if (currentTimer.state === 'running') {
    // Running state
    elements.timerTime.textContent = formatTime(currentTimer.timeRemaining);
    elements.timerMode.textContent = currentTimer.mode === 'focus' ? 'Focusing' : 'On Break';
    elements.actionBtn.textContent = 'Pause';
    elements.statusMessage.style.display = 'none';
    elements.skipBtn.style.display = 'inline-block';
  } else if (currentTimer.state === 'paused') {
    // Paused state
    elements.timerTime.textContent = formatTime(currentTimer.timeRemaining);
    elements.timerMode.textContent = currentTimer.mode === 'focus' ? 'Focus Paused' : 'Break Paused';
    elements.actionBtn.textContent = 'Resume';
    elements.statusMessage.style.display = 'none';
    elements.skipBtn.style.display = 'inline-block';
  } else if (currentTimer.state === 'completed') {
    // Completed state
    elements.timerTime.textContent = '00:00';
    
    if (currentTimer.mode === 'focus') {
      elements.timerMode.textContent = 'Focus Complete!';
      elements.statusMessage.textContent = 'Great job! Take a break?';
      elements.actionBtn.textContent = 'Start Break';
    } else {
      elements.timerMode.textContent = 'Break Complete!';
      elements.statusMessage.textContent = 'Ready to focus?';
      elements.actionBtn.textContent = 'Start Focus';
    }
    elements.statusMessage.style.display = 'block';
    elements.skipBtn.style.display = 'none';
  }
}

/**
 * Update statistics display
 */
function updateStats(): void {
  if (!currentStats) return;
  
  elements.sessionCount.textContent = String(currentStats.sessionsCompleted);
  elements.totalTime.textContent = formatDuration(currentStats.totalFocusTime);
}

/**
 * Start UI refresh interval
 */
function startUIRefresh(): void {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  timerInterval = window.setInterval(async () => {
    if (currentTimer?.state === 'running') {
      await loadTimerStatus();
    }
  }, 1000);
}

/**
 * Handle settings form submit
 */
async function handleSettingsSubmit(e: Event): Promise<void> {
  e.preventDefault();
  
  const form = e.target as HTMLFormElement;
  const formData = new FormData(form);
  
  const settings: Settings = {
    focusDuration: Number(formData.get('focusDuration')) * 60,
    breakDuration: Number(formData.get('breakDuration')) * 60,
    notifications: formData.get('notifications') === 'on',
    testMode: formData.get('testMode') === 'on',
  };
  
  await saveSettings(settings);
  currentSettings = settings;
  closeSettings();
  
  // Update display if idle
  if (!currentTimer || currentTimer.state === 'idle') {
    updateUI();
  }
}

/**
 * Open settings modal
 */
function openSettings(): void {
  elements.settingsModal.setAttribute('aria-hidden', 'false');
  elements.closeSettingsBtn.focus();
}

/**
 * Close settings modal
 */
function closeSettings(): void {
  elements.settingsModal.setAttribute('aria-hidden', 'true');
  elements.settingsBtn.focus();
}

/**
 * Send message to background script
 */
async function sendMessage(action: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action }, (response: unknown) => {
      resolve((response as { success: boolean; data?: unknown; error?: string }) || { success: false, error: 'No response' });
    });
  });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initialize);
