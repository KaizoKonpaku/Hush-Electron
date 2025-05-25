const {
  app,
  BrowserWindow,
  globalShortcut,
  desktopCapturer,
  ipcMain,
  screen,
} = require('electron')
const fs = require('fs')
const path = require('path')
require('dotenv').config()
const AIService = require('./ai_service')

// Prevent the app from showing in the dock
if (process.platform === 'darwin') {
  app.setActivationPolicy('accessory')
}

// Settings management
const settingsPath = path.join(app.getPath('userData'), 'settings.json')

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
      return settings
    }
  } catch (error) {
    console.error('Error loading settings:', error)
  }
  return {}
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    return true
  } catch (error) {
    console.error('Error saving settings:', error)
    return false
  }
}

// Load settings and initialize AIService with saved API key
const initialSettings = loadSettings()
let apiKey = initialSettings.apiKey || process.env.GOOGLE_AI_API_KEY || ''
let aiService = new AIService(apiKey)

// Store the current session's screenshots
let sessionScreenshots = []

// Enable hot reload in development
try {
  require('electron-reloader')(module, {
    debug: true,
    watchRenderer: true,
  })
} catch (_) {
  console.log('Error hot reloading')
}

let mainWindow
let settingsWindow

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.close()
    settingsWindow = null
    return
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 700,
    title: 'Hush Settings',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: false,
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset',
    vibrancy: 'dark',
    visualEffectState: 'active',
    frame: false,
    transparent: true,
    icon: path.join(__dirname, 'build/icon.svg'),
    hiddenInMissionControl: true,
    excludedFromShownWindowsMenu: true,
    type: 'panel',
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    simpleFullscreen: false,
    resizable: true,
    minWidth: 500,
    minHeight: 700
  })

  settingsWindow.loadFile('settings.html')

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show()
    if (process.platform === 'darwin') {
      settingsWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
        skipTransformProcessType: true,
      })
      settingsWindow.setAlwaysOnTop(true, 'screen-saver', 2)
      if (settingsWindow.setContentProtection) {
        settingsWindow.setContentProtection(true)
      }
    }
  })

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function createWindow() {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  
  // Calculate window position
  // Center horizontally and 9% from the top
  const windowWidth = 1000
  const windowHeight = 200
  const xPosition = Math.floor((width - windowWidth) / 2)
  const yPosition = Math.floor(height * 0.09)
  
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: xPosition,
    y: yPosition,
    show: true,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    type: 'panel',
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    simpleFullscreen: false,
    movable: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    title: 'Hush',
    focusable: false,
    hasShadow: false,
    enableLargerThanScreen: true,
    maxWidth: 9999,
    maxHeight: 9999,
    hiddenInMissionControl: true,
    excludedFromShownWindowsMenu: true,
    icon: path.join(__dirname, 'build/icon.svg'),
  })

  mainWindow.loadFile('index.html')

  if (process.platform === 'darwin') {
    // Always hide the dock icon
    app.dock.hide()

    mainWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    })

    mainWindow.setAlwaysOnTop(true, 'screen-saver', 2)
    mainWindow.setIgnoreMouseEvents(true, {
      forward: true,
      ignoreCursor: true,
    })

    if (mainWindow.setContentProtection) {
      mainWindow.setContentProtection(true)
    }

    mainWindow.on('show', () => {
      mainWindow.moveTop()
      mainWindow.setIgnoreMouseEvents(true, {
        forward: true,
        ignoreCursor: true,
      })
    })

    // Helper function to register keyboard shortcuts
    function registerShortcut(accelerator, callback) {
      globalShortcut.register(accelerator, callback);
    }

    // Helper function to ensure window is visible and properly positioned
    function ensureWindowVisibility() {
      if (!mainWindow.isVisible()) {
        mainWindow.showInactive()
      }
      mainWindow.moveTop()
      mainWindow.setIgnoreMouseEvents(true, {
        forward: true,
        ignoreCursor: true,
      })
    }

    // Register keyboard shortcuts
    registerShortcut('Command+H', () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        ensureWindowVisibility()
      }
    })

    registerShortcut('Command+C', async () => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: {
            width: 1920, // Increased size for better quality
            height: 1080,
          },
        })

        // Get the primary display
        const primaryDisplay = sources[0]

        if (primaryDisplay) {
          const screenshotsDir = path.join(
            app.getPath('userData'),
            'screenshots'
          )
          if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir)
          }

          const filename = `screenshot_${Date.now()}.png`
          const screenshotPath = path.join(screenshotsDir, filename)

          // Write the screenshot and wait for it to complete
          await fs.promises.writeFile(
            screenshotPath,
            primaryDisplay.thumbnail.toPNG()
          )

          // Add to session screenshots
          sessionScreenshots.push({
            path: screenshotPath,
            timestamp: Date.now(),
          })

          ensureWindowVisibility()

          // Send the updated screenshots array
          mainWindow.webContents.send('screenshots-updated', sessionScreenshots)

          // Also hide response menu if visible, but keep response content
          mainWindow.webContents.send('hide-response-menu')
        }
      } catch (error) {
        console.error('Screenshot error:', error)
        mainWindow.webContents.send(
          'screenshot-error',
          'Failed to capture screenshot'
        )
      }
    })

    registerShortcut('Command+N', () => {
      sessionScreenshots = []
      mainWindow?.webContents.send('reset-app')
    })

    registerShortcut('Command+,', () => {
      createSettingsWindow()
    })

    registerShortcut('Command+Q', () => {
      app.quit()
    })

    registerShortcut('Command+Return', () => {
      mainWindow?.webContents.send('check-screenshot')
      ensureWindowVisibility()
    })

    // Update movement step size for more coverage
    const MOVE_STEP = 50

    // Update arrow key shortcuts for larger movements
    registerShortcut('Command+Up', () => {
      const [x, y] = mainWindow.getPosition()
      mainWindow.setPosition(x, y - MOVE_STEP)
    })

    registerShortcut('Command+Down', () => {
      const [x, y] = mainWindow.getPosition()
      mainWindow.setPosition(x, y + MOVE_STEP)
    })

    registerShortcut('Command+Left', () => {
      const [x, y] = mainWindow.getPosition()
      mainWindow.setPosition(Math.max(0, x - MOVE_STEP), y)
    })

    registerShortcut('Command+Right', () => {
      const [x, y] = mainWindow.getPosition()
      mainWindow.setPosition(x + MOVE_STEP, y)
    })

    // Add shortcut to delete the most recent screenshot
    registerShortcut('Command+D', () => {
      if (sessionScreenshots.length > 0) {
        // Remove the most recent screenshot
        sessionScreenshots.pop()
        // Update the UI
        mainWindow?.webContents.send('screenshots-updated', sessionScreenshots)
      }
    })
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('get-content-size')
  })
}

app.whenReady().then(() => {
  // Make sure the dock icon is hidden as early as possible
  if (process.platform === 'darwin') {
    app.dock.hide()
  }
  createWindow()
})

// Also ensure dock stays hidden on activate event
app.on('activate', () => {
  if (process.platform === 'darwin') {
    app.dock.hide()
  }
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

ipcMain.on('update-window-size', (event, size) => {
  if (mainWindow) {
    const [currentWidth] = mainWindow.getSize()
    const newHeight = Math.max(size.height + 40, 100)
    mainWindow.setSize(currentWidth, newHeight)
  }
})

// IPC handlers for settings
ipcMain.on('get-settings', (event) => {
  const settings = loadSettings()
  event.reply('settings-loaded', settings)
})

// Helper function to update settings and handle response
function updateSetting(event, key, value, successCallback = null) {
  const settings = loadSettings()
  settings[key] = value

  if (saveSettings(settings)) {
    if (successCallback) successCallback(value)
    event.reply('settings-saved')
    return true
  } else {
    event.reply('settings-error', `Failed to save ${key}`)
    return false
  }
}

ipcMain.on('save-api-key', (event, apiKey) => {
  updateSetting(event, 'apiKey', apiKey, (newKey) => {
    // Update the AI service with new key
    aiService = new AIService(newKey)
  })
})

ipcMain.on('save-prompt', (event, prompt) => {
  updateSetting(event, 'customPrompt', prompt)
})

// Update handlers for API key updates - legacy support
ipcMain.on('update-api-key', (event, newApiKey) => {
  const success = updateSetting(event, 'apiKey', newApiKey, (newKey) => {
    apiKey = newKey
    aiService = new AIService(apiKey)
  })
  
  event.reply('api-key-updated', {
    success,
    error: success ? null : 'Failed to save API key',
  })
})

ipcMain.on('update-prompt', (event, prompt) => {
  const success = updateSetting(event, 'customPrompt', prompt)
  
  event.reply('prompt-updated', {
    success,
    error: success ? null : 'Failed to save prompt',
  })
})

// Update the analyze-screenshot handler to use multiple screenshots
ipcMain.on('analyze-screenshots', async (event) => {
  try {
    if (sessionScreenshots.length === 0) {
      mainWindow.webContents.send('analysis-error', 'No screenshots to analyze')
      return
    }

    // Check if API key is valid
    if (!aiService.isApiKeyValid()) {
      mainWindow.webContents.send('analysis-error', 'NO_API_KEY')
      return
    }

    const settings = loadSettings()
    const screenshotPaths = sessionScreenshots.map(
      (screenshot) => screenshot.path
    )
    const analysis = await aiService.analyzeMultipleImages(
      screenshotPaths,
      settings.customPrompt
    )
    mainWindow.webContents.send('analysis-result', analysis)
  } catch (error) {
    mainWindow.webContents.send('analysis-error', error.message)
  }
})

// Add handler to get current screenshots
ipcMain.on('get-screenshots', (event) => {
  event.reply('screenshots-updated', sessionScreenshots)
})

// Add handler to remove a screenshot
ipcMain.on('remove-screenshot', (event, index) => {
  if (index >= 0 && index < sessionScreenshots.length) {
    // Remove from array
    sessionScreenshots.splice(index, 1)
    // Send updated list
    event.reply('screenshots-updated', sessionScreenshots)
  }
})
