// import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItemConstructorOptions } from 'electron'
import { app, BrowserWindow, ipcMain, dialog, powerMonitor } from 'electron'
import path from 'node:path'
import portfinder from 'portfinder'
import { autoUpdater } from 'electron-updater'
import fs from 'fs'
import { randomBytes } from 'crypto'
import { spawn, ChildProcess } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { TelemetryEventPackage } from '../src/hooks/useTelemetry'

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

let serverProcess: ChildProcess | null = null
let win: BrowserWindow | null
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'] // 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x

const SUPABASE_URL = 'https://zdfbyydaiewiqvpymmtf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkZmJ5eWRhaWV3aXF2cHltbXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTc3NDA0NzAsImV4cCI6MjAxMzMxNjQ3MH0.N2eAAr8Xv9NghkOBJjqrgWXtzx4IdgpVyB4QrFbK_Yk';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const USERDATAPATH = path.join(app.getPath('appData'), 'pocketllm') // All user info will be stored here. This directory is persistent across udpates
if (!fs.existsSync(USERDATAPATH)){
  fs.mkdirSync(USERDATAPATH)
}

const IDENTITY_FILE = path.join(USERDATAPATH, 'user_identity.json') // User pseudonyme identity construction and retrieval
interface Identity {
  machine_id: string;
  gmail_id: string | null;
}

const getUserIdentity = () => {
  let identity : Identity
  if (fs.existsSync(IDENTITY_FILE)) {
    identity = JSON.parse(fs.readFileSync(IDENTITY_FILE, 'utf8'))
  } else {
    const machine_id = randomBytes(16).toString('hex')
    identity = { 
      machine_id, 
      gmail_id: null,
    }
    fs.writeFileSync(IDENTITY_FILE, JSON.stringify(identity))
  }

  const userID = identity.gmail_id ? `${identity.gmail_id} | ${identity.machine_id}` : identity.machine_id
  return { userID }
}

let  { userID }  = getUserIdentity()
console.log(`User ID: ${userID}`)

function createWindow() {
  win = new BrowserWindow({
    frame: false,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1200, // default width
    height: 900, // default height
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    title: "PocketLLM"
  })

  // During dev - console can be useful 
  // On production uncomment the following lines - disable user openning console using 'cmd + option +i'
  // const template: MenuItemConstructorOptions[]  = [
  //   {
  //     label: 'Edit',
  //     submenu: [
  //       { role: 'undo' },
  //       { role: 'redo' },
  //       { type: 'separator' },
  //       { role: 'cut' },
  //       { role: 'copy' },
  //       { role: 'paste' },
  //       { role: 'pasteAndMatchStyle' },
  //       { role: 'delete' },
  //       { role: 'selectAll' }
  //     ]
  //     //... any other custom menus we want
  //   }
  // ];
  // Menu.setApplicationMenu(Menu.buildFromTemplate(template));

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

  ipcMain.on("closeApp", ()=>{ //close window
    win?.close()
  })

  ipcMain.on("minimizeApp", ()=>{
    win?.minimize()
  })

  ipcMain.on("fullscreen", ()=>{
    if (win?.isFullScreen()) {
      win?.setFullScreen(false)
    } else {
      win?.setFullScreen(true)
    }
  })

  let pdfWin: BrowserWindow | null = null;

  ipcMain.removeAllListeners('open-pdf-window')
  ipcMain.on('open-pdf-window', (_, pdfURL) => {
    pdfWin = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        plugins: true  // This is necessary to display PDFs
      }
    });
  
    pdfWin.loadURL(pdfURL);
  
    pdfWin.on('closed', () => {
      pdfWin = null;
    });
  })

  ipcMain.removeAllListeners('open-file-dialog')
  ipcMain.on('open-file-dialog', (event) => {
    dialog.showOpenDialog(win!, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'docx'] }
      ]
    }).then(result => {
      if (!result.canceled && result.filePaths.length > 0) {
        // Map through each file path and get file details including size
        const files = result.filePaths.map(filePath => {
          const stats = fs.statSync(filePath)

          return  {
            filePath,
            fileName: path.basename(filePath),
            fileSize: stats.size, // Size of file in bytes
          }
        });
        event.sender.send('selected-files', files);
      }
    }).catch(err => {
      console.log(err);
    })
  })

  ipcMain.removeAllListeners('open-csv-file-dialog')
  ipcMain.on('open-csv-file-dialog', (event) => {
    const urlRegex = /https?:\/\/[^\s,]+/g; // Regular expression for URL validation

    // Function to validate and extract URLs from a string
    const extractUrls = (text: string): string[] => {
      const urls = text.match(urlRegex);
      return urls || [];
    };

    dialog.showOpenDialog(win!, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    }).then(result => {
      if (!result.canceled && result.filePaths.length > 0) {
        // Annotate allExtractedUrls as an array of strings
        const allExtractedUrls: string[] = [];
  
        result.filePaths.forEach(filePath => {
          try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const extractedUrls = extractUrls(fileContent);
            allExtractedUrls.push(...extractedUrls);
          } catch (err) {
            console.error('Error reading file:', err);
          }
        });
  
        event.sender.send('extracted-urls', allExtractedUrls);
      }
    }).catch(err => {
      console.log(err);
    });
  })

  ipcMain.removeAllListeners('open-single-csv-file-dialog')
  ipcMain.on('open-single-csv-file-dialog', (event) => {

    dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    }).then(result => {
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]; // Since it's a single file selection
  
        event.sender.send('gmail-dump-csv', filePath)
      }
    }).catch(err => {
      console.log(err);
    });
  })

  ipcMain.removeAllListeners('open-folder-dialog')
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
  })

  const os = require('os') // used inside telemetry

  ipcMain.removeAllListeners('get-os-type')
  ipcMain.on('get-os-type', (event) => {
    event.returnValue = os.type()
  })

  ipcMain.removeAllListeners('get-os-release')
  ipcMain.on('get-os-release', (event) => {
    event.returnValue = os.release()
  })

  ipcMain.removeAllListeners('get-os-arch')
  ipcMain.on('get-os-arch', (event) => {
    event.returnValue = os.arch()
  })

  ipcMain.removeAllListeners('save-telemetry-data')
  ipcMain.on('save-telemetry-data', (event, data) => {
    const fs = require('fs');
  
    const telemeryFilePath = path.join(USERDATAPATH, 'telemetry-data.json');
    console.log(`telemetry-data is stored at ${telemeryFilePath}`);
  
    const newEventData = JSON.parse(data);
  
    const processData = (fileContents: string) => {
      let existingData = [];
      try {
          existingData = JSON.parse(fileContents);
      } catch (parseErr) {
          console.log(`Telemetry data Json parse error ${parseErr}`);
          return;
      }
  
      const mergedData = existingData.concat(newEventData);

      const mergedDataWithUserID = mergedData.map((eventPackage: TelemetryEventPackage)  => ({
        ...eventPackage,
        UserName: userID
      }))
  
      fs.writeFile(telemeryFilePath, JSON.stringify(mergedDataWithUserID, null, 2), (writeErr: NodeJS.ErrnoException | null) => {
        if (writeErr) {
          console.error(`Error writing to file: ${writeErr}`);
          event.sender.send('telemetry-data-save-result', 'error');
        } else {
          console.log(`Current telemetry data length: ${mergedDataWithUserID.length}`)
          if (mergedDataWithUserID.length >= 2) {
            sendToDatabase(mergedDataWithUserID);
          }
        }
      });
    };
  
    const sendToDatabase = async (events: TelemetryEventPackage[]) => {
        const formattedEvents = events.map(event => ({
          username: event.UserName,
          timestamp: event.timestamp,
          user_machine: event.UserMachine,
          event: event.event
        }))

        try {
          const { error } = await supabase.from('telemetry_events').insert(formattedEvents);
          if (error) {
              console.error("Error inserting data to PostgreSQL:", error);
          } else {
              console.log("Data inserted to PostgreSQL successfully");

              fs.writeFile(telemeryFilePath, JSON.stringify([], null, 2), (writeErr: NodeJS.ErrnoException | null) => {
                if (writeErr) {
                  console.error(`Error clearing file after database update: ${writeErr}`);
                } else {
                  console.log('Local file cleared after successful database update');
                }
            });
          }
        } catch (err) {
          console.error('Error saving data to Supabase:', err);
        }
    };
  
    if (fs.existsSync(telemeryFilePath)) {
      fs.readFile(telemeryFilePath, 'utf8', (readErr: NodeJS.ErrnoException | null, fileContents: string) => {
        if (readErr) {
          console.log(`Encounter read error ${readErr}`);
          return;
        }
        processData(fileContents);
      });
    } else {
      processData('[]');
    }
  })

  ipcMain.removeAllListeners('open-external-url')
  ipcMain.on('open-external-url', (_, url) => {
    const { shell } = require('electron');
    shell.openExternal(url);
  })

  ipcMain.removeHandler('show-save-dialog')
  ipcMain.handle('show-save-dialog', async (_) => {
    const result = await dialog.showSaveDialog(win!, {
      title: 'Save File',
      defaultPath: app.getPath('documents'),
      buttonLabel: 'Save',
      // filters to specify allowed file types
      filters: [
        { name: 'Neural DB Files', extensions: ['neural-workspace'] },
      ]
    })
  
    if (!result.canceled && result.filePath) {
      return result.filePath
    } else {
      return null
    }
  })
}

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill()
    console.log('Python server process killed before app quit')
  }
})

app.on('will-quit', () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill()
    console.log('Python server process killed on app quit')
  }
})

app.on('window-all-closed', () => {
  // Quit app when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }

  if (serverProcess && !serverProcess.killed) { // Kill the Python process if it's running
    serverProcess.kill()
    console.log('Python server process killed on window-all-closed')
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    startBackend()
    createWindow()
  }
})

ipcMain.removeHandler('restart-backend')
ipcMain.handle('restart-backend', async () => {
  if (serverProcess && !serverProcess.killed) { // Check if serverProcess is running and kill it
    serverProcess.kill('SIGKILL')
    console.log('Existing server process killed')
  }

  await startBackend()
  console.log('Backend restarted successfully')
})

async function startBackend() {
  const availablePort = await portfinder.getPortPromise();

  console.log(`Found port available: ${availablePort}`)

  ipcMain.removeHandler('get-port')
  ipcMain.handle('get-port', (_) => {
    return availablePort
  })

  // Start the FastAPI server as a child process
  const pythonExecutablePath = app.isPackaged ? 
                                path.join(app.getAppPath(), '..', 'main', 'main') : 
                                path.join(__dirname, '../main/main')

  console.log('pythonExecutablePath:', pythonExecutablePath)

  serverProcess = spawn(pythonExecutablePath, [availablePort.toString(), USERDATAPATH])

  console.log('spawn success')

  serverProcess.stdout!.on('data', (data) => { // Handle server process outputs or errors
    console.log(`Server Output: ${data}`)
  })
  
  serverProcess.stderr!.on('data', (data) => {
    console.error(`Server Error: ${data}`)

    const message = data.toString()
    if (message.includes("Application startup complete.")) {
      win?.webContents.send('server-ready') // notify electron render process FastAPI server is ready
    }
  })
}

app.whenReady().then(async () => {

  startBackend() // start backend

  createWindow() // create main application window

  autoUpdater.checkForUpdatesAndNotify() // initialize auto-updater after the main window has been created

  autoUpdater.on('update-available', () => {
    console.log('Update available.')
    win?.webContents.send('update-available') // send message to render process to notify users about an available update.
  })

  autoUpdater.on('error', (error) => {
    console.error(`Update error: ${error.toString()}`)
  })

  ipcMain.on('accept-update', () => {
    console.log('User accepted the update. Installing...')
    autoUpdater.quitAndInstall()
  })
  
  ipcMain.on('deny-update', () => {
    console.log('User denied the update.')
  })

  powerMonitor.on('resume', () => {
    console.log('System has resumed from sleep');
    
    win?.webContents.send('power-restarted')
  })
})