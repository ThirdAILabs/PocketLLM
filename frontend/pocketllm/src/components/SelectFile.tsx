import { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { usePort } from '../PortContext'
import ProgressBar from './ProgressBar'
import { WorkSpaceFile } from '../App'
import useTelemetry from '../hooks/useTelemetry'
import { WorkSpaceMetadata } from '../App'
import { ModelDisplayInfo } from '../App'
import Tooltip from '@mui/material/Tooltip';

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
    setCurrentUsage: React.Dispatch<React.SetStateAction<number>>
}

export default function SelectFile(props: SelectFileProps) {
    const {
        selectedFiles, setSelectedFiles, 
        progress, setProgress, 
        startProgress, setStartProgress,
        curWorkSpaceID, setCurWorkSpaceID, setWorkSpaceMetadata,
        currentModel,
        setCurrentUsage
    } = props;

    const closeBtn = useRef<HTMLButtonElement>(null)

    const [draggover, setDraggover] = useState(false);

    const { port } = usePort()

    // State variable to manage WebSocket connection
    const [_, setWebSocket] = useState<null | WebSocket>(null);

    // For telemetry
    const recordEvent = useTelemetry()

    useEffect(() => {
        const handler = (files: WorkSpaceFile[]) => {
          // files is now an array of {filePath, fileName}
          const newFiles = files.filter(({ filePath }) => 
            !selectedFiles.some(file => file.filePath === filePath)
          ).map(file => ({
            ...file,
            isSaved: false,
            uuid: uuidv4(),
          }));
      
          setSelectedFiles(prevFiles => [...prevFiles, ...newFiles]);
        }

        const cleanup = window.electron.on('selected-files', handler);

        return () => {
          cleanup();
        };
      }, []);

      const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDraggover(false);
        const files = Array.from(event.dataTransfer.files);
        const fileDetails: WorkSpaceFile[] = files.map(file => ({
          filePath: file.path,
          fileName: file.name,
          fileSize: file.size,
          isSaved: false,
          uuid: uuidv4(),
        }));

        console.log(fileDetails)

        setSelectedFiles(prevFiles => [...prevFiles, ...fileDetails]);
      };

      const addModel = () => {
        try {
            // Initialize the WebSocket connection when "Add to Model" button is clicked
            const ws = new WebSocket(`ws://localhost:${port}/index_files`);

            ws.onopen = () => {
                console.log('WebSocket Client Connected')

                setStartProgress(true);

                // Calculate the total size of the files to be uploaded
                const totalSize = selectedFiles.reduce((acc, file) => acc + file.fileSize, 0)
                // Convert the total size to megabytes and update current usage
                const totalSizeInMB = totalSize / (1024 * 1024)

                console.log(`Total file trained size: ${totalSizeInMB}`)
                setCurrentUsage(prevUsage => prevUsage + totalSizeInMB)

                const filePaths = selectedFiles.map(file => file.filePath)

                ws.send(JSON.stringify({ filePaths }))
            };
    
            ws.onmessage = (message) => {
                const data = JSON.parse(message.data);
                setProgress(data.progress);
                console.log(data.progress, data.message)

                if (data.complete === true) {
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

                        // Close the training UI
                        closeBtn.current?.click()
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
        <Tooltip title="File">
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
                {/* <div className='font-sm'>File</div> */}
            </button>
        </Tooltip>
        
 

        <div className="modal fade" id="exampleModal" tabIndex={-1} aria-labelledby="exampleModalLabel" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header border-0 ">
                        <button ref = {closeBtn} type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div className="modal-body pt-0">
                       
                       {
                        startProgress 
                        ?
                        <></>
                        :
                        <div onDrop={onDrop} onDragOver={(e) => {e.preventDefault(); setDraggover(true)}} 
                            onDragLeave={(e) => {e.preventDefault(); setDraggover(false)}}
                            className={`drop-zone drop-zone-innerwrapper drop-zone-wrapper ${ draggover? " drop-zone-drag" : ""}`} 
                            onClick={ selectFiles}>
                            <i className="bi bi-upload fs-2 text-secondary mb-2"></i>
                            Drop files (.PDF .DOCX .CSV) or click to select files.
                        </div>
                       }

                        {
                            startProgress ?
                            <div className='my-2'>
                                <ProgressBar progress={progress}/>
                            </div>
                            
                            :
                            <></>
                        }

                        {
                            startProgress ?
                            <></>
                            :
                            <>
                                {
                                    selectedFiles.length > 0 ?
                                    <>
                                    <hr className='my-2'/>
                                    <div className='mb-3'>
                                        <div className='d-flex font-x-sm'>Selected files</div>
            
                                        <ul style={{maxHeight: "140px", overflow: "auto"}}>
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
                                        <div className='d-flex justify-content-center'>
                                            <button className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                                    onClick={ addModel }>
                                                Add to workspace
                                            </button>
                                        </div>
                                    </div>
                                    <hr className='my-2'/>
                                    </>
                                    :
                                    <></>
                                }
                            </>
                        }
                        
                        
                    </div>
                </div>
            </div>
        </div>
    </>

  )
}
