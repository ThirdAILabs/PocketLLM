// import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItemConstructorOptions } from 'electron'
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import portfinder from 'portfinder'
import { autoUpdater } from 'electron-updater'

import { spawn, ChildProcess } from 'child_process'
let serverProcess: ChildProcess | null = null

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

import express, { Request, Response } from 'express'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'
import { TelemetryEventPackage } from '../src/hooks/useTelemetry'

const expressApp = express();
const PORT = 3000;

// Supabase configuration (Get these values from your Supabase dashboard)
const SUPABASE_URL = 'https://zdfbyydaiewiqvpymmtf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkZmJ5eWRhaWV3aXF2cHltbXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTc3NDA0NzAsImV4cCI6MjAxMzMxNjQ3MH0.N2eAAr8Xv9NghkOBJjqrgWXtzx4IdgpVyB4QrFbK_Yk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

expressApp.use(express.json());

expressApp.post('/save-json', async (req: Request, res: Response) => {
    const events: TelemetryEventPackage[] = req.body;

    const formattedEvents = events.map(event => ({
        username: event.UserName,
        timestamp: event.timestamp,
        user_machine: event.UserMachine,
        event: event.event
    }))

    try {
      const { error } = await supabase.from('telemetry_events').insert(formattedEvents);
      if (error) {
          console.error("Error inserting data:", error);
      } else {
          console.log("Data inserted successfully");
      }
    } catch (err) {
        console.error('Error saving data to Supabase:', err);
        res.status(500).send('Error saving data');
    }
});

expressApp.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


function createWindow() {
  win = new BrowserWindow({
    frame: false,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 1200, // default width
    height: 900, // default height
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
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

  //close window
  ipcMain.on("closeApp", ()=>{
    // probably need more work here to completely exit
    win?.close();
  })

  ipcMain.on("minimizeApp", ()=>{
    console.log("Received minimizeApp event");
    win?.minimize();
  })

  ipcMain.on("fullscreen", ()=>{
    if (win?.isFullScreen()) {
      win?.setFullScreen(false)
    } else {
      win?.setFullScreen(true)
    }
  })

  let pdfWin: BrowserWindow | null = null;

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
  });

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

  // OS methods are used for telemetry
  const os = require('os')

  ipcMain.on('get-os-type', (event) => {
    event.returnValue = os.type()
  })

  ipcMain.on('get-os-release', (event) => {
    event.returnValue = os.release()
  })

  ipcMain.on('get-os-arch', (event) => {
    event.returnValue = os.arch()
  })

  ipcMain.on('save-telemetry-data', (event, data) => {
      const fs = require('fs');
      
      // Get the path to the user's appData directory, then join it with your app's name.
      const userDataPath = path.join(app.getPath('appData'), 'pocketllm')

      // Ensure the directory exists
      if (!fs.existsSync(userDataPath)){
        fs.mkdirSync(userDataPath);
      }

      const filePath = path.join(userDataPath, 'telemetry-data.json')

      console.log(`telemetry-data is stored at ${filePath}`)

      const newEventData = JSON.parse(data); // This will be the new data to save.

      if (fs.existsSync(filePath)) {
          fs.readFile(filePath, 'utf8', (readErr: NodeJS.ErrnoException | null, fileContents: string) => {
              if (readErr) {
                  console.log(`Encounter read error ${readErr}`)
                  return;
              }

              let existingData = [];
              try {
                  existingData = JSON.parse(fileContents);
              } catch (parseErr) {
                  console.log(`Telemetry data Json parse error ${parseErr}`)
                  return;
              }

              const mergedData = existingData.concat(newEventData);

              axios.post('http://localhost:3000/save-json', mergedData)
              .then(response => {
                  console.log('Data saved to PostgreSQL:', response.data);
                  // ... rest of the logic ...
              })
              .catch(error => {
                  console.error('Error saving data to PostgreSQL:', error)
              });

              fs.writeFile(filePath, JSON.stringify(mergedData, null, 2), (writeErr: NodeJS.ErrnoException | null) => {
                  if (writeErr) {
                      console.error(`Error saving data to PostgreSQL: ${writeErr}`)
                      event.sender.send('telemetry-data-save-result', 'error');
                  } else {
                      console.error(`Save data to PostgreSQL success`)
                  }
              });
          });
      } else {
          // File doesn't exist, so we'll create it and add the new event data inside an array.
          fs.writeFile(filePath, JSON.stringify([newEventData], null, 2), (writeErr: NodeJS.ErrnoException | null) => {
              if (writeErr) {
                  console.error(`Encounter write error ${writeErr}`)
              } else {
                  console.log(`File write success`)
              }
          });
      }
  });

  // Remove the existing 'show-save-dialog' handler if any
  ipcMain.removeHandler('show-save-dialog');

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

  ipcMain.on('open-external-url', (_, url) => {
    const { shell } = require('electron');
    shell.openExternal(url);
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

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null

    // If on non-macOS, kill the Python process if it's running
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill()
      console.log('Python server process killed on window-all-closed')
    }
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
  serverProcess.stdout!.on('data', (data) => {
    console.log(`Server Output: ${data}`)
  })
  
  serverProcess.stderr!.on('data', (data) => {
    console.error(`Server Error: ${data}`)

    // Notify render process FastAPI server is ready
    const message = data.toString()
    if (message.includes("Application startup complete.")) {
      win?.webContents.send('server-ready')
    }
  })

  // Create the main application window
  createWindow()

  // Initialize auto-updater after the main window has been created
  autoUpdater.checkForUpdatesAndNotify()

  autoUpdater.on('update-available', () => {
    console.log('Update available.')
    // Send a message to the renderer to notify users about an available update.
    win?.webContents.send('update-available')
  })

  autoUpdater.on('error', (error) => {
    console.error(`Update error: ${error.toString()}`);
  })

  ipcMain.on('accept-update', () => {
    console.log('User accepted the update. Installing...')
    autoUpdater.quitAndInstall()
  })
  
  ipcMain.on('deny-update', () => {
    console.log('User denied the update.')
  })
})