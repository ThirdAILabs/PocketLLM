/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    DIST: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

interface Electron {
  on: (channel: string, func: (...args: any[]) => void) => () => void
  send: (channel: string, data?: any) => void
  invoke: (channel: string, data?: any) => Promise<any>
  openExternalUrl: (url: string) => void
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer
  electron: Electron
}
