const { app, BrowserWindow, shell } = require('electron')

// The desktop shell wraps the deployed web app, so every push to main
// updates this app too — no re-download needed.
const APP_URL = 'https://orb-app-liard.vercel.app'
const APP_ORIGIN = new URL(APP_URL).origin

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 720,
    minHeight: 560,
    title: 'orb',
    // Paper, so the frame never flashes white before the page paints.
    backgroundColor: '#FBFAF7',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.loadURL(APP_URL)

  // Anything leaving the app opens in the real browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (new URL(url).origin !== APP_ORIGIN) {
      e.preventDefault()
      shell.openExternal(url)
    }
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
