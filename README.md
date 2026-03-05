# TrueFocus

A minimal, elegant Pomodoro timer Chrome extension with session tracking and 3-day history.

![TrueFocus Screenshot](screenshot.png)

## Features

- **Simple Pomodoro Timer**: 25-minute focus sessions with 5-minute breaks
- **Minimal UI**: Clean text-based timer display (no distracting progress rings)
- **Session Tracking**: Automatically records start/end times for all sessions
- **Skip Button**: Skip current timer and switch between focus/break modes
- **Statistics**: Track daily sessions and total focus time (e.g., "1h 15m")
- **3-Day History**: Maintains rolling history of the last 3 days
- **Test Mode**: Enable 5-second minimum timers for quick testing
- **Pause & Resume**: Pause anytime and resume where you left off
- **Auto-Popup**: Automatically opens popup when timer completes
- **Keyboard Shortcuts**: Space to pause/resume, Escape to close settings

## Installation

### Development

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

### Production

1. Build:
   ```bash
   npm run build
   ```
2. Zip the `dist` folder
3. Upload to Chrome Web Store

## Usage

### Basic Flow

1. Click **"Start Focus"** to begin a 25-minute timer
2. Timer counts down with large, clear display
3. Click **"Pause"** to pause, **"Resume"** to continue
4. Click **"Skip"** to skip to break (or break to focus)
5. When timer completes, popup auto-opens with next action

### Settings

Access settings via the gear icon:

- **Focus Duration**: 1-60 minutes (default: 25)
- **Break Duration**: 1-30 minutes (default: 5)
- **Notifications**: Toggle Chrome notifications
- **Test Mode**: Enable 5-second minimum for testing

### Statistics

The popup shows:
- **Sessions today**: Count of completed sessions
- **Total time**: Cumulative focus time (e.g., "3h 45m")

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+F` / `Cmd+Shift+F` | Open TrueFocus popup |
| `Ctrl+Shift+T` / `Cmd+Shift+T` | Toggle timer (Start/Pause/Resume) |
| `Space` | Pause/Resume timer (when popup open) |
| `Escape` | Close settings modal |

## Data Storage

All data is stored locally using `chrome.storage.local`:

### Active Timer
Current timer state including:
- State (idle, running, paused, completed)
- Mode (focus/break)
- Time remaining
- Session start time
- Pause timestamp (if paused)

### Session History (3 days)
```typescript
{
  "2024-03-06": {
    date: "2024-03-06",
    totalFocusTime: 4500,  // seconds
    totalBreakTime: 900,   // seconds
    sessionsCompleted: 3,
    sessions: [
      {
        id: "...",
        mode: "focus",
        startTime: 1709701200000,
        endTime: 1709702700000,
        duration: 1500,
        plannedDuration: 1500,
        completed: true
      }
    ]
  }
}
```

### Settings
- `focusDuration`: Focus session length (seconds)
- `breakDuration`: Break length (seconds)
- `notifications`: Enable notifications (boolean)
- `testMode`: Enable test mode (boolean)

## Project Structure

```
truefocus/
├── manifest.json              # Manifest V3 configuration
├── package.json               # Dependencies
├── tsconfig.json             # TypeScript config
├── vite.config.ts            # Build configuration
├── popup.html                # Popup HTML
├── README.md                 # This file
├── src/
│   ├── background.ts         # Service worker entry
│   ├── types.ts             # TypeScript definitions
│   ├── background/
│   │   └── timer.ts         # Timer logic & session management
│   ├── popup/
│   │   ├── popup.ts         # Popup script
│   │   └── popup.css        # Minimal dark theme styles
│   └── utils/
│       ├── helpers.ts       # Helper functions
│       └── storage.ts       # Storage utilities
├── public/
│   ├── _locales/            # i18n messages
│   └── icons/               # Extension icons
└── dist/                    # Build output
```

## Development

### Scripts

```bash
npm run build      # Build for production
npm run watch      # Build and watch for changes
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript type checking
```

### Technologies

- **Manifest V3**: Chrome extension format
- **TypeScript**: Type-safe JavaScript
- **Vite**: Fast build tool
- **Chrome APIs**: storage, alarms, notifications, commands

### Building

```bash
# Development build
npm run build

# The extension is built into `dist/` folder
# Load `dist/` folder as unpacked extension in Chrome
```

## Permissions

- `storage`: Store timer state and session history
- `alarms`: Schedule timer ticks (every second)
- `notifications`: Show session completion notifications

## UI Design

### Dark Theme
- Deep gradient background (#0f0f23 → #2d1b4e)
- Large, readable timer display (72px)
- Glassmorphism cards with subtle transparency
- Gradient text effects
- Smooth animations and hover states

### Minimal Interface
- Single primary action button
- Skip button (shows during active sessions)
- Compact stats section
- Modal settings panel
- No distracting progress rings

## Session Lifecycle

1. **Start**: User clicks "Start Focus"
2. **Running**: Timer counts down, badge shows remaining minutes
3. **Pause**: User pauses (can resume anytime)
4. **Skip**: User skips to next phase (saves partial time)
5. **Complete**: Timer reaches 0
   - Saves to history
   - Shows notification
   - Auto-opens popup
   - Offers next action (start break/focus)

## Browser Compatibility

- Chrome 88+ (Manifest V3)
- Edge 88+
- Opera 74+
- Any Chromium-based browser supporting Manifest V3

## Auto-Popup Feature

When a timer completes, the extension automatically opens the popup. This requires:
- Chrome 127+ (for `chrome.action.openPopup()` API)
- On older versions, only notification is shown

## License

MIT License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Build and test
5. Submit a pull request

## Changelog

### v1.0.0
- Initial release
- Minimal Pomodoro timer
- Session tracking with 3-day history
- Skip button functionality
- Test mode for quick testing
- Auto-popup on completion
