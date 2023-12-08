// import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItemConstructorOptions } from 'electron'
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import portfinder from 'portfinder'
import { autoUpdater } from 'electron-updater'
import fs from 'fs'
import { randomBytes } from 'crypto'
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
const expressPORT = 3792;

// Supabase configuration (Get these values from your Supabase dashboard)
const SUPABASE_URL = 'https://zdfbyydaiewiqvpymmtf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkZmJ5eWRhaWV3aXF2cHltbXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTc3NDA0NzAsImV4cCI6MjAxMzMxNjQ3MH0.N2eAAr8Xv9NghkOBJjqrgWXtzx4IdgpVyB4QrFbK_Yk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

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
          res.status(500).send('Error saving data');
      } else {
          console.log("Data inserted successfully");
          res.status(200).send('Data saved successfully');
      }
    } catch (err) {
        console.error('Error saving data to Supabase:', err);
        res.status(500).send('Error saving data');
    }
});

expressApp.listen(expressPORT, () => {
    console.log(`Express server running on http://localhost:${expressPORT}`);
});


// All user info will be stored here.
// This directory is persistent across udpates
const USERDATAPATH = path.join(app.getPath('appData'), 'pocketllm');
if (!fs.existsSync(USERDATAPATH)){
  fs.mkdirSync(USERDATAPATH);
}

// User pseudonyme identity construction and retrieval
const IDENTITY_FILE = path.join(USERDATAPATH, 'user_identity.json')

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

// Define an interface for usage data
interface UsageData {
  size: number; // Total size used
  resetDate: Date; // The date when the usage was last reset
}

// Usage
const USAGE_FILE = path.join(USERDATAPATH, 'usage.json')

// Function to get or create the usage data
const getOrCreateUsageData = (): UsageData => {
  let usageData: UsageData;

  if (fs.existsSync(USAGE_FILE)) {
    // Read the existing usage data
    const data = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    usageData = {
      size: data.size,
      resetDate: new Date(data.resetDate)
    };

    const lastResetDate = usageData.resetDate;
    const currentDate = new Date();

    // Check if the last reset was more than a month ago
    if (currentDate.getMonth() !== lastResetDate.getMonth() ||
        currentDate.getFullYear() !== lastResetDate.getFullYear()) {
      
      console.log('Reset the usage data in a new month.')
      
      usageData.size = 0;
      usageData.resetDate = new Date(); // Keep this as a Date object
    }
  } else {
    console.log('Writing the usage file for first time.')

    // Create new usage data with initial values
    usageData = {
      size: 0,
      resetDate: new Date(), // Keep this as a Date object
    };
  }

  // Serialize and write to file if necessary
  fs.writeFileSync(USAGE_FILE, JSON.stringify({
    size: usageData.size,
    resetDate: usageData.resetDate.toISOString() // Convert to string here
  }, null, 2));

  return usageData;
}

const usageData = getOrCreateUsageData()
console.log(`Current Usage: ${usageData.size} MB`)
console.log(`Usage Reset Date: ${usageData.resetDate.toISOString()}`)


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
  });

  // Set up a listener for the 'open-file-dialog' message
  ipcMain.on('open-file-dialog', (event) => {
    dialog.showOpenDialog(win!, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'csv', 'docx'] }
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
  });

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
  });

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
  
    const sendToDatabase = (data: TelemetryEventPackage[]) => {
      axios.post(`http://localhost:${expressPORT}/save-json`, data)
        .then(response => {
          if (response.status === 200) {
            console.log('Data saved to PostgreSQL:', response.data);
            fs.writeFile(telemeryFilePath, JSON.stringify([], null, 2), (writeErr: NodeJS.ErrnoException | null) => {
              if (writeErr) {
                console.error(`Error clearing file after database update: ${writeErr}`);
              } else {
                console.log('Local file cleared after successful database update');
              }
            });
          } else {
            console.error('Received non-success status from database:', response.status);
          }
        })
        .catch(error => {
          console.error('Error saving data to PostgreSQL:', error);
        });
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
  });

  // Remove the existing 'update-usage' handler if any
  ipcMain.removeHandler('update-usage')

  ipcMain.handle('update-usage', async (_, newSize) => {
    if (fs.existsSync(USAGE_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
        data.size = newSize; // Assuming newSize is the new total size to set
  
        fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2));
        return 'success';
      } catch (error) {
        console.error(`Error writing to file: ${error}`);
        throw error; // This will send an error back to the renderer process
      }
    } else {
      throw new Error('Usage file not found.');
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

  // Remove the existing 'get-current-usage' handler if any
  ipcMain.removeHandler('get-current-usage')

  ipcMain.handle('get-current-usage', async (_) => {
    const usageData = getOrCreateUsageData();
    
    const formattedUsageData = {
      size: usageData.size,
      resetDate: usageData.resetDate.toISOString()
    };
    return formattedUsageData;
  })

  ipcMain.removeAllListeners('open-external-url')

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

app.on('window-all-closed', () => {
  // Quit app when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }

  // Kill the Python process if it's running
  if (serverProcess && !serverProcess.killed) {
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

async function startBackend() {
  const availablePort = await portfinder.getPortPromise();

  console.log(`found port ${availablePort}`)

  // Remove the existing 'get-port' handler if any
  ipcMain.removeHandler('get-port');

  ipcMain.handle('get-port', (_) => {
    return availablePort;
  });

  // Start the FastAPI server as a child process
  const pythonExecutablePath = app.isPackaged ? 
                                path.join(app.getAppPath(), '..', 'main', 'main') : 
                                path.join(__dirname, '../main/main')

  console.log('pythonExecutablePath:', pythonExecutablePath)

  serverProcess = spawn(pythonExecutablePath, [availablePort.toString(), USERDATAPATH])

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
}

app.whenReady().then(async () => {

  startBackend()

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