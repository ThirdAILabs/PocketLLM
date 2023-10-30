import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { usePort } from '../PortContext'
import ProgressBar from './ProgressBar'
import { WorkSpaceFile } from '../App'
import useTelemetry from '../hooks/useTelemetry'
import { WorkSpaceMetadata } from '../App'
import { ModelDisplayInfo } from '../App'

interface SelectFileProps {
    selectedFiles: WorkSpaceFile[];
    setSelectedFiles: React.Dispatch<React.SetStateAction<WorkSpaceFile[]>>;
    progress: number;
    setProgress: React.Dispatch<React.SetStateAction<number>>;
    startProgress: boolean;
    setStartProgress: React.Dispatch<React.SetStateAction<boolean>>;
    curWorkSpaceID: string|null,
    setCurWorkSpaceID: React.Dispatch<React.SetStateAction<string|null>>,
    setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
    currentModel: ModelDisplayInfo | null,
}

export default function SelectFile(props: SelectFileProps) {
    const {
        selectedFiles, setSelectedFiles, 
        progress, setProgress, 
        startProgress, setStartProgress,
        curWorkSpaceID, setCurWorkSpaceID, setWorkSpaceMetadata,
        currentModel
    } = props;

    const { port } = usePort()

    // State variable to manage WebSocket connection
    const [_, setWebSocket] = useState<null | WebSocket>(null);

    // For telemetry
    const recordEvent = useTelemetry()

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
                    isSaved: false,
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

                ws.send(JSON.stringify({ filePaths }))
            };
    
            ws.onmessage = (message) => {
                const data = JSON.parse(message.data);
                setProgress(data.progress);
                console.log(data.progress, data.message)

                if (data.progress === 100) {
                    if (curWorkSpaceID === null) {
                        // Create a new workspace
                        const newWorkSpaceID = uuidv4()   // Generate a new unique workspace ID
                        setCurWorkSpaceID(newWorkSpaceID) // Set the current workspace ID

                        const newWorkSpaceMetadata = {
                            workspaceID: newWorkSpaceID,
                            workspaceName: selectedFiles[0].fileName,
                            model_info: {
                                author_name: currentModel ? currentModel.author_name : 'thirdai',
                                model_name: currentModel ? currentModel.model_name : 'Default model',
                            },
                            documents: selectedFiles,
                            last_modified: new Date().toISOString(),
                            isWorkSpaceSaved: false,
                        };

                        setWorkSpaceMetadata(prevMetaData => [...prevMetaData, newWorkSpaceMetadata]);
                    } else {
                        // Index new file into existing workspace
                        setWorkSpaceMetadata(prevMetaData => prevMetaData.map(workspace => {
                            if (workspace.workspaceID === curWorkSpaceID) {
                                // Combine existing documents with newly selected files
                                const updatedDocuments = [...workspace.documents, ...selectedFiles]

                                // Update the isWorkSpaceSaved property of the matching workspace
                                return { ...workspace, 
                                        documents: updatedDocuments, 
                                        isWorkSpaceSaved: false 
                                    };
                            } else {
                                // Return other workspaces without modification
                                return workspace;
                            }
                        }))
                    }

                    setTimeout(() => {
                        setStartProgress(false)
                        setProgress(0)

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
  
        <button onClick={(_) => 
                    recordEvent({
                        UserAction: 'Click',
                        UIComponent: 'add-file button',
                        UI: 'SelectFile',
                    })}
                type="button" 
                className="btn btn-general mx-1 pt-0 h-100" 
                id="select-file-btn" 
                data-bs-toggle="modal" 
                data-bs-target="#exampleModal">
            <i className="bi bi-file-earmark fs-6"></i>
            <div className='font-sm'>File</div>
        </button>
 

        <div className="modal fade" id="exampleModal" tabIndex={-1} aria-labelledby="exampleModalLabel" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
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
                    </div>
                </div>
            </div>
        </div>
    </>

  )
}
