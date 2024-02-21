import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'

import { usePort } from '../../contexts/PortContext'
import { WorkSpaceFile, WorkSpaceMetadata } from '../../App'
import ProgressBar from '../ProgressBar'
import useTelemetry from '../../hooks/useTelemetry'

type createFileWorkspaceProps = {
  setCurWorkSpaceID: (modelID: string | null) => void,
  setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>,
  modalRef: React.RefObject<HTMLDivElement>
}

export default function CreateFileWorkspace(    
  {
    setCurWorkSpaceID,
    setWorkSpaceMetadata,
    modalRef
  } : createFileWorkspaceProps) {

    const [draggover, setDraggover] = useState(false)

    const [progress, setProgress] = useState(0)
    const [startProgress, setStartProgress] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<WorkSpaceFile[]>([])
    
    const { port } = usePort()

    const navigate = useNavigate()

    const closeBtn = useRef<HTMLButtonElement>(null)

    const recordEvent = useTelemetry()


    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDraggover(false)
      const files = Array.from(event.dataTransfer.files)
      const fileDetails: WorkSpaceFile[] = files.map(file => ({
        filePath: file.path,
        fileName: file.name,
        fileSize: file.size,
        isSaved: false,
        uuid: uuidv4(),
      }))

      console.log(fileDetails)

      setSelectedFiles(prevFiles => [...prevFiles, ...fileDetails])
    }

    const selectFiles = () => {
      window.electron.send('open-file-dialog')
    }

    const removeFile = (uuid: string) => {
      setSelectedFiles(prevFiles => prevFiles.filter(file => file.uuid !== uuid))
    }

    const createWorkspace = async () => {

      // Always first reset neural db before creating a new workspace
      const response = await axios.post(`http://localhost:${port}/reset_neural_db`)
        
      if (response.data.success) {
          setCurWorkSpaceID(null)
      } else {
          console.error("Backend reset failed:", response.data.msg);
      }

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

              const filePaths = selectedFiles.map(file => file.filePath)

              ws.send(JSON.stringify({ filePaths }))

              recordEvent({
                  UserAction: `Upload ${filePaths.length} files ${totalSizeInMB}mbs in total`,
                  UIComponent: 'drop-file area',
                  UI: 'SelectFile',
              })
          };
  
          ws.onmessage = (message) => {
              const data = JSON.parse(message.data);
              setProgress(data.progress);
              console.log(data.progress, data.message)

              if (data.complete === true) {
                  // Create a new workspace
                  const newWorkSpaceID = uuidv4()   // Generate a new unique workspace ID
                  setCurWorkSpaceID(newWorkSpaceID) // Set the current workspace ID

                  const newWorkSpaceMetadata = {
                      workspaceID: newWorkSpaceID,
                      workspaceName: selectedFiles[0].fileName,
                      model_info: {
                          author_name: 'thirdai',
                          model_name: 'Default model'
                      },
                      documents: selectedFiles,
                      last_modified: new Date().toISOString(),
                      isWorkSpaceSaved: false,
                  }

                  setWorkSpaceMetadata(prevMetaData => [...prevMetaData, newWorkSpaceMetadata]);

                  navigate(`/file/:${newWorkSpaceID}`)

                  setTimeout(() => {
                      setProgress(0)
                      setStartProgress(false)
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
              setStartProgress(false)
          };
      } catch (error) {
          console.error('Error:', error);
          setStartProgress(false);
      }
    }

    useEffect(() => {
      const handler = (files: WorkSpaceFile[]) => {
        // files is an array of {filePath, fileName}
        const newFiles = files.filter(({ filePath }) => 
          !selectedFiles.some(file => file.filePath === filePath)
        ).map(file => ({
          ...file,
          isSaved: false,
          uuid: uuidv4(),
        }))
    
        setSelectedFiles(prevFiles => [...prevFiles, ...newFiles])
      }

      const cleanup = window.electron.on('selected-files', handler)

      return () => {
        cleanup()
      }
    }, [])

    return (
      <div  className="modal fade" id="fileWorkspaceCreate" ref = {modalRef} tabIndex={-1} aria-labelledby="fileWorkspaceCreateLabel" aria-hidden="true" 
            data-bs-backdrop="static">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">

                    {
                        startProgress
                        ?
                        <></>
                        :
                        <div className="modal-header border-0 ">
                            <button ref = {closeBtn} type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"/>
                        </div>
                    }

                    <div className="modal-body pt-0">
                       
                       {
                        startProgress
                        ?
                        <div className='my-2'>
                          <ProgressBar progress={progress}/>
                        </div>
                        :
                        <>
                          <div onDrop={onDrop} onDragOver={(e) => {e.preventDefault(); setDraggover(true)}} 
                              onDragLeave={(e) => {e.preventDefault(); setDraggover(false)}}
                              className={`drop-zone drop-zone-innerwrapper drop-zone-wrapper ${ draggover? " drop-zone-drag" : ""}`} 
                              onClick={ selectFiles }>
                              <i className="bi bi-upload fs-2 text-secondary mb-2"></i>
                              Drop files (.PDF .DOCX) or click to select files.
                          </div>
                          {
                              selectedFiles.length > 0 
                              ?
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
                                                  onClick={ createWorkspace }>
                                              Create workspace
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
    )
  }
  