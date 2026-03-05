import { 
  initializeBackground, 
  handleTimerTick, 
  startFocus, 
  startBreak,
  pauseTimer, 
  resumeTimer, 
  stopTimer,
  skipTimer,
  getTimerStatus,
  getTodayStatistics
} from './background/timer';

/**
 * Service Worker: Background script entry point
 */

// Initialize on install/update
chrome.runtime.onInstalled.addListener((details) => {
  // eslint-disable-next-line no-console
  console.log('[TrueFocus] Extension installed:', details.reason);
  initializeBackground();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  initializeBackground();
});

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'truefocus-timer') {
    handleTimerTick();
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  const handleAsync = async () => {
    switch (request.action) {
      case 'startFocus':
        await startFocus();
        return { success: true };
        
      case 'startBreak':
        await startBreak();
        return { success: true };
        
      case 'pauseTimer':
        await pauseTimer();
        return { success: true };
        
      case 'resumeTimer':
        await resumeTimer();
        return { success: true };
        
      case 'stopTimer':
        await stopTimer();
        return { success: true };

      case 'skipTimer':
        await skipTimer();
        return { success: true };

      case 'getTimerStatus':
        const status = await getTimerStatus();
        return { success: true, data: status };
        
      case 'getTodayStats':
        const stats = await getTodayStatistics();
        return { success: true, data: stats };
        
      default:
        return { success: false, error: 'Unknown action' };
    }
  };
  
  handleAsync()
    .then(sendResponse)
    .catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
  
  return true;
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-timer') {
    getTimerStatus().then((status) => {
      if (!status || status.state === 'idle' || status.state === 'completed') {
        startFocus();
      } else if (status.state === 'running') {
        pauseTimer();
      } else if (status.state === 'paused') {
        resumeTimer();
      }
    });
  }
});

// Initialize on load
initializeBackground();
