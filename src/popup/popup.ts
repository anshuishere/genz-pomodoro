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
  modeIcon: document.getElementById('mode-icon') as unknown as SVGSVGElement,
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
  
  // Test mode toggle - update labels immediately
  const testModeCheckbox = elements.settingsForm.querySelector('input[name="testMode"]') as HTMLInputElement;
  testModeCheckbox?.addEventListener('change', (e) => {
    updateDurationLabels((e.target as HTMLInputElement).checked);
  });
  
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
  
  // Update duration labels based on test mode
  updateDurationLabels(currentSettings.testMode);
}

/**
 * Update duration input labels based on test mode
 */
function updateDurationLabels(isTestMode: boolean): void {
  const unit = isTestMode ? 'seconds' : 'minutes';
  const focusLabel = document.querySelector('label[for="focus-duration"]');
  const breakLabel = document.querySelector('label[for="break-duration"]');
  
  if (focusLabel) focusLabel.textContent = `Focus Duration (${unit})`;
  if (breakLabel) breakLabel.textContent = `Break Duration (${unit})`;
  
  // Update input values
  const focusInput = document.getElementById('focus-duration') as HTMLInputElement;
  const breakInput = document.getElementById('break-duration') as HTMLInputElement;
  
  if (isTestMode) {
    // Convert to seconds for display
    focusInput.value = String(currentSettings.focusDuration);
    breakInput.value = String(currentSettings.breakDuration);
    focusInput.min = '5';
    breakInput.min = '5';
  } else {
    // Convert to minutes for display
    focusInput.value = String(Math.floor(currentSettings.focusDuration / 60));
    breakInput.value = String(Math.floor(currentSettings.breakDuration / 60));
    focusInput.min = '1';
    breakInput.min = '1';
  }
}

/**
 * Update UI based on current state
 */
/**
 * Update icon based on mode
 */
function updateModeIcon(mode: TimerMode): void {
  const useElement = elements.modeIcon.querySelector('use');
  if (useElement) {
    useElement.setAttribute('href', mode === 'focus' ? '#icon-focus' : '#icon-break');
  }
}

/**
 * Update color theme based on mode
 */
function updateColorTheme(mode: TimerMode): void {
  if (mode === 'break') {
    document.body.classList.add('break-mode');
  } else {
    document.body.classList.remove('break-mode');
  }
}

function updateUI(): void {
  if (!currentTimer || currentTimer.state === 'idle') {
    // Idle state - default to focus mode styling
    elements.timerTime.textContent = formatTime(currentSettings.focusDuration);
    elements.timerMode.textContent = 'Ready to Focus';
    elements.actionBtn.textContent = 'Start Focus';
    elements.statusMessage.style.display = 'none';
    elements.skipBtn.style.display = 'none';
    updateModeIcon('focus');
    updateColorTheme('focus');
  } else if (currentTimer.state === 'running') {
    // Running state
    elements.timerTime.textContent = formatTime(currentTimer.timeRemaining);
    elements.timerMode.textContent = currentTimer.mode === 'focus' ? 'Focusing' : 'On Break';
    elements.actionBtn.textContent = 'Pause';
    elements.statusMessage.style.display = 'none';
    elements.skipBtn.style.display = 'inline-block';
    updateModeIcon(currentTimer.mode);
    updateColorTheme(currentTimer.mode);
  } else if (currentTimer.state === 'paused') {
    // Paused state
    elements.timerTime.textContent = formatTime(currentTimer.timeRemaining);
    elements.timerMode.textContent = currentTimer.mode === 'focus' ? 'Focus Paused' : 'Break Paused';
    elements.actionBtn.textContent = 'Resume';
    elements.statusMessage.style.display = 'none';
    elements.skipBtn.style.display = 'inline-block';
    updateModeIcon(currentTimer.mode);
    updateColorTheme(currentTimer.mode);
  } else if (currentTimer.state === 'completed') {
    // Completed state
    elements.timerTime.textContent = '00:00';
    updateModeIcon(currentTimer.mode);
    updateColorTheme(currentTimer.mode);
    
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
  const isTestMode = formData.get('testMode') === 'on';
  
  // If test mode, values are in seconds, otherwise in minutes
  const multiplier = isTestMode ? 1 : 60;
  
  const settings: Settings = {
    focusDuration: Number(formData.get('focusDuration')) * multiplier,
    breakDuration: Number(formData.get('breakDuration')) * multiplier,
    notifications: formData.get('notifications') === 'on',
    testMode: isTestMode,
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
