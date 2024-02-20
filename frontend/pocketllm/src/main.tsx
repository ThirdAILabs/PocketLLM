import React, {useEffect} from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { PortProvider, usePort } from './contexts/PortContext.tsx'
import { BackendControlProvider } from './contexts/BackendControlContext.tsx'

function Main() {
    const { setPort } = usePort()

    async function fetchAndSetPort() {
      const port = await window.electron.invoke('get-port')
      setPort(port)
      console.log("fetch and set port from main process:", port)
    }

    const checkBackendStatus = async () => {
      try {
        const port = await window.electron.invoke('get-port')
        const response = await fetch(`http://localhost:${port}/check_live`)
        if (!response.ok) throw new Error('Backend not responding')
        const data = await response.json()
        console.log(data.message); // Should log "Backend is alive"
      } catch (error) {
        console.error('Backend check failed, attempting to restart')
        restartBackend()
      }
    }

    const restartBackend = async () => {
      await window.electron.invoke('restart-backend') // signal main process to restart the backend
      fetchAndSetPort() // Fetch and set the new port
    }

    useEffect(() => {
      fetchAndSetPort()

      const intervalId = setInterval(checkBackendStatus, 5000)

      return () => clearInterval(intervalId) // Cleanup the interval on component unmount
    }, [setPort])

    return (
      <BackendControlProvider restartBackend={restartBackend}>
        <React.StrictMode>
            <App />
        </React.StrictMode>
      </BackendControlProvider>
    )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <PortProvider>
    <Main />
  </PortProvider>
)

// Remove Preload scripts loading
postMessage({ payload: 'removeLoading' }, '*')

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
