import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { usePort } from '../PortContext'
import ProgressBar from './ProgressBar'

interface SelectedFile {
    fileName: string;
    filePath: string;
    uuid: string;
}

export default function SelectFile() {
    const { port } = usePort()

    const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
    const [indexFiles, setIndexFiles] = useState<SelectedFile[]>([]);
    const [progress, setProgress] = useState(0);
    const [startProgress, setStartProgress] = useState(false);

    // State variable to manage WebSocket connection
    const [_, setWebSocket] = useState<null | WebSocket>(null);

    useEffect(() => {
        const handler = ({filePath, fileName}: {filePath: string, fileName: string}) => {
            console.log(filePath, fileName)

            // Check if file path already exists
            const fileExists = selectedFiles.some(file => file.filePath === filePath)
            if (fileExists)
                return

            setSelectedFiles(prevFiles => [
                ...prevFiles,
                {
                    fileName: fileName,
                    filePath: filePath,
                    uuid: uuidv4(), // Generate a new UUID for each file
                },
            ])
        }

        const cleanup = window.electron.on('selected-file', handler)
    
        return () => {
          cleanup()
        }
      }, [])

      const addModel = () => {
        try {
            // Initialize the WebSocket connection when "Add to Model" button is clicked
            const ws = new WebSocket(`ws://localhost:${port}/index_files`);

            ws.onopen = () => {
                console.log('WebSocket Client Connected')

                setStartProgress(true);

                const filePaths = selectedFiles.map(file => file.filePath)

                // Send a message to the server to start the computation via WebSocket
                ws.send(JSON.stringify({ startComputation: true, filePaths }))
            };
    
            ws.onmessage = (message) => {
                const data = JSON.parse(message.data);
                setProgress(data.progress);
                console.log(data.progress, data.message);

                if (data.progress === 100) {
                    setTimeout(() => {
                        setStartProgress(false)
                        setProgress(0)

                        setIndexFiles([...indexFiles, ...selectedFiles])
                        setSelectedFiles([])
                    }, 500);
                }
            };
    
            ws.onerror = (error) => {
                console.error(`WebSocket Error: ${error}`);
            };
    
            ws.onclose = () => {
                console.log('WebSocket connection closed');
                setWebSocket(null);
                setStartProgress(false)
            };
            setWebSocket(ws);
        } catch (error) {
            console.error('Error:', error);
            setStartProgress(false);
        }
    }    

    const selectFiles = () => {
        window.electron.send('open-file-dialog')
    }

    const removeFile = (uuid: string) => {
        setSelectedFiles(prevFiles => prevFiles.filter(file => file.uuid !== uuid))
    }

  return (
    <>
        <button type="button" className="btn bg-transparent btn-general" id="select-file-btn" data-bs-toggle="modal" data-bs-target="#exampleModal">
            <i className="bi bi-plus-circle"></i>
        </button>

        <div className="modal fade" id="exampleModal" tabIndex={-1} aria-labelledby="exampleModalLabel" aria-hidden="true">
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header border-0 ">
                        <button type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div className="modal-body pt-0">
                        <div className='d-flex justify-content-center mb-4'>
                            <button className='btn bg-secondary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                    onClick={ selectFiles }>
                                Select files...
                            </button>
                            <button className='btn bg-secondary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                    onClick={ addModel }>
                                Add to model
                            </button>
                        </div>

                        {
                            startProgress ?
                            <ProgressBar progress={progress}/>
                            :
                            <></>
                        }
                        <hr className='my-2'/>
                        <div className='mb-3'>
                            <div className='d-flex font-x-sm'>Selected files</div>
                            <ul>
                            {
                                selectedFiles.map((file) => (
                                    <li key={file.uuid} className="file-item">
                                    {file.fileName.length > 20 ? file.fileName.slice(0, 20) + '...' : file.fileName}
                                        <button className='btn ms-2' onClick={() => removeFile(file.uuid)}>
                                            <i className="bi bi-x-circle-fill text-secondary"></i>
                                        </button>
                                    </li>
                                ))
                            }
                            </ul>
                        </div>
                        <hr className='my-2'/>
                        <div className='mb-3'>
                            <div className='d-flex font-x-sm'>Indexed files</div>

                            {
                                indexFiles.map((file) => (
                                    <li key={file.uuid} className="file-item">
                                    {file.fileName.length > 20 ? file.fileName.slice(0, 20) + '...' : file.fileName}
                                        <button className='btn ms-2' onClick={() => removeFile(file.uuid)}>
                                            <i className="bi bi-x-circle-fill text-secondary"></i>
                                        </button>
                                    </li>
                                ))
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </>

  )
}
