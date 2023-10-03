import React, {useEffect} from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { PortProvider, usePort } from './PortContext'

function Main() {
  const { setPort } = usePort();

  useEffect(() => {
    async function fetchPort() {
      const port = await window.electron.invoke('get-port');
      setPort(port);
      console.log("Port from main process:", port);
    }

    fetchPort();
  }, [setPort]);

  return (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
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
