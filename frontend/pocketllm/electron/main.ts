import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import portfinder from 'portfinder'

import { spawn } from 'child_process'
let serverProcess

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')


let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST, 'index.html'))
  }

  // Set up a listener for the 'open-file-dialog' message
  ipcMain.on('open-file-dialog', (event) => {
    dialog.showOpenDialog(win!, {
      properties: ['openFile'],
    }).then(result => {
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]
        const fileName = path.basename(filePath)
        event.sender.send('selected-file', {filePath, fileName})
      }
    }).catch(err => {
      console.log(err)
    })
  })

  // Set up a listener for the 'open-folder-dialog' message
  ipcMain.on('open-folder-dialog', (event) => {
    dialog.showOpenDialog({
      properties: ['openDirectory']
    }).then(result => {
      if (!result.canceled && result.filePaths.length > 0) {
        event.sender.send('selected-folder', result.filePaths[0]);
      }
    }).catch(err => {
      console.log(err);
    });
  });

  ipcMain.handle('show-save-dialog', async (_) => {
    const result = await dialog.showSaveDialog(win!, {
      title: 'Save File',
      defaultPath: app.getPath('documents'),
      buttonLabel: 'Save',
      // filters to specify allowed file types
      filters: [
        { name: 'Neural DB Files', extensions: ['ndb'] },
      ]
    })
  
    if (!result.canceled && result.filePath) {
      return result.filePath
    } else {
      return null
    }
  })
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  
  const availablePort = await portfinder.getPortPromise();

  console.log(`found port ${availablePort}`)

  ipcMain.handle('get-port', (_) => {
    return availablePort;
  });

  // Start the FastAPI server as a child process
  const pythonExecutablePath = app.isPackaged ? 
                                path.join(app.getAppPath(), '..', 'main', 'main') : 
                                path.join(__dirname, '../main/main')

  console.log('pythonExecutablePath:', pythonExecutablePath)

  serverProcess = spawn(pythonExecutablePath, [availablePort.toString()])

  console.log('spawn success')

  // Handle server process outputs or errors
  serverProcess.stdout.on('data', (data) => {
    console.log(`Server Output: ${data}`)
  })
  
  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`)
  })

  // Create the main application window
  createWindow()
})