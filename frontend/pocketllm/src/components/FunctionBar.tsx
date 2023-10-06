import { useEffect } from 'react'
import Teach from "./Teach"
import axios from "axios"
import { usePort } from '../PortContext'

export default function FunctionBar() {
  const { port } = usePort()

  const handleSave = () => {
    // Use Electron IPC to show save dialog
    window.electron.invoke('show-save-dialog')
      .then(filePath => {
        if (filePath) {
          console.log('File will be saved to:', filePath);
          
          // Here save the file to the chosen path
          axios.post(`http://0.0.0.0:${port}/save`, { filePath })
            .then(response => {
              console.log('File path sent successfully:', response.data)
            })
            .catch(error => {
              console.error('Error sending file path:', error)
            })

        } else {
          console.log('Save dialog was canceled');
        }
      })
      .catch(err => console.error('Error showing save dialog', err));
  }

  const handleLoad = () => {
    window.electron.send('open-folder-dialog')
  }

  useEffect(() => {
    const handler = (folderPath: string) => {
      console.log(`Load model from ${folderPath}`)
      axios.post(`http://localhost:${port}/load`, {
        filePath: folderPath
      })
      .then(response => {
        console.log(response.data);
      })
      .catch(error => {
        console.error("Error sending folder path to backend:", error)
      })
    }

    const cleanup = window.electron.on('selected-folder', handler)
  
    return () => {
      cleanup()
    }
  }, [port])

  return (
    <div className='d-flex mb-3'>
        <Teach/>
        <button onClick={ handleLoad } className='btn btn-general mx-1'>
            <i className="bi bi-cloud-plus"></i>
            <div className='font-sm'>Load</div>
        </button>
        <button className='btn btn-general mx-1' onClick={handleSave}>
            <i className="bi bi-file-earmark-arrow-down"></i>
            <div className='font-sm'>Save</div>
        </button>
        <button className='btn btn-general mx-1'>
            <i className="bi bi-box-arrow-right"></i>
            <div className='font-sm'>Exit</div>
        </button>
    </div>
  )
}
