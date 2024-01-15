
import React, { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import useTelemetry from '../hooks/useTelemetry'
import { usePort } from '../PortContext'
import ProgressBar from './ProgressBar';
import { WorkSpaceMetadata } from '../App'
import { ModelDisplayInfo } from '../App'
import Tooltip from '@mui/material/Tooltip';
import googleLogo from "../assets/gmail.svg";

type LoadUrlProps = {
  setCurWorkSpaceID: React.Dispatch<React.SetStateAction<string|null>>,
  setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
  currentModel: ModelDisplayInfo | null,
  setCurrentUsage: React.Dispatch<React.SetStateAction<number>>
}

export default function LoadGmailDump({ setWorkSpaceMetadata, setCurWorkSpaceID, currentModel, setCurrentUsage}: LoadUrlProps) {
  const { port } = usePort()
  const closeBtn = React.useRef<HTMLButtonElement>(null)
  const [startProgress, setStartProgress] = useState(false)
  const [progress, setProgress] = useState(0)
  const [draggover, setDraggover] = useState(false)

  // For telemetry
  const recordEvent = useTelemetry()

  useEffect(() => {

    if (port) {
      const handler = (filePath: string) => {
        // console.log(filePath)
  
        const ws = new WebSocket(`ws://localhost:${port}/gmail_train_from_csv`)
      
        ws.onopen = () => {
          ws.send(JSON.stringify({ csv_file_path: filePath }));
          setStartProgress(true);
    
          setCurrentUsage(prevUsage => prevUsage + 5)
        }
    
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          setProgress(data.progress);
          console.log(`Progress: ${data.progress}% - ${data.message}`);
    
    
          if (data.complete === true) {
              setTimeout(()=>{
                closeBtn.current?.click()
              }, 500)
    
              // Create a new workspace
              const newWorkSpaceID = uuidv4()   // Generate a new unique workspace ID
              setCurWorkSpaceID(newWorkSpaceID) // Set the current workspace ID
    
              const selectedFiles = [
                  {
                      fileName: `Gmail workspace file`,
                      filePath: `Gmail workspace path`,
                      fileSize: (5.3 / 1000 * 10), // This is only an estimate based on: 1000 emails = 5.3MB
                      isSaved: false,
                      uuid: uuidv4(),
                  }
              ]
    
              const newWorkSpaceMetadata = {
                  workspaceID: newWorkSpaceID,
                  workspaceName: `Gmail workspace`,
                  model_info: {
                      author_name: currentModel ? currentModel.author_name : 'thirdai',
                      model_name: currentModel ? currentModel.model_name : 'Default model',
                  },
                  documents: selectedFiles,
                  last_modified: new Date().toISOString(),
                  isWorkSpaceSaved: false,
              };
    
              setWorkSpaceMetadata(prevMetaData => [...prevMetaData, newWorkSpaceMetadata]);
    
              setTimeout(() => {
                  setStartProgress(false);
                  setProgress(0);
              }, 700)
          }
        };
    
        ws.onerror = (error) => {
          console.error('WebSocket Error:', error)
          setStartProgress(false)
        }
    
        ws.onclose = () => {
          console.log('WebSocket connection closed')
          setStartProgress(false)
        }
  
      }
  
      const cleanup = window.electron.on('gmail-dump-csv', handler);
  
      return () => {
        cleanup();
      };
    }

  }, [port]);

  const selectFile = () => {
    window.electron.send('open-single-csv-file-dialog')
  }

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDraggover(false)
    const files = Array.from(event.dataTransfer.files)
    const first_file = files[0]
    const filePath = first_file.path

    // console.log(filePath)

    const ws = new WebSocket(`ws://localhost:${port}/gmail_train_from_csv`)
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ csv_file_path: filePath }));
      setStartProgress(true);

      setCurrentUsage(prevUsage => prevUsage + 5)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress);
      console.log(`Progress: ${data.progress}% - ${data.message}`);


      if (data.complete === true) {
          setTimeout(()=>{
            closeBtn.current?.click()
          }, 500)

          // Create a new workspace
          const newWorkSpaceID = uuidv4()   // Generate a new unique workspace ID
          setCurWorkSpaceID(newWorkSpaceID) // Set the current workspace ID

          const selectedFiles = [
              {
                  fileName: `Gmail workspace file`,
                  filePath: `Gmail workspace path`,
                  fileSize: (5.3 / 1000 * 10), // This is only an estimate based on: 1000 emails = 5.3MB
                  isSaved: false,
                  uuid: uuidv4(),
              }
          ]

          const newWorkSpaceMetadata = {
              workspaceID: newWorkSpaceID,
              workspaceName: `Gmail workspace`,
              model_info: {
                  author_name: currentModel ? currentModel.author_name : 'thirdai',
                  model_name: currentModel ? currentModel.model_name : 'Default model',
              },
              documents: selectedFiles,
              last_modified: new Date().toISOString(),
              isWorkSpaceSaved: false,
          };

          setWorkSpaceMetadata(prevMetaData => [...prevMetaData, newWorkSpaceMetadata]);

          setTimeout(() => {
              setStartProgress(false);
              setProgress(0);
          }, 700)
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error)
      setStartProgress(false)
    }

    ws.onclose = () => {
      console.log('WebSocket connection closed')
      setStartProgress(false)
    }

    
  };

  function openLinkExternally(e: React.MouseEvent<HTMLAnchorElement>) {
      e.preventDefault();
      window.electron.openExternalUrl(e.currentTarget.href);
  }

  return (
    <>
      <Tooltip title="GMail">
        <button onClick={(_) => 
                        recordEvent({
                            UserAction: 'Click',
                            UIComponent: 'add-gmail-dump button',
                            UI: 'LoadGmailDump',
                })} 
                type="button" 
                className="btn btn-general px-2 mx-1 h-100" 
                data-bs-toggle="modal" 
                data-bs-target="#gdModal">
              <img src={googleLogo} placeholder='Gmail' style={{width: '25px'}}/>
        </button>
      </Tooltip>

      <div className="modal fade" id="gdModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header border-0 ">
                <button ref={closeBtn} type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body pt-0">
              {
                startProgress ?
                <div className='pt-3 px-2'>
                  <ProgressBar progress={progress}/>
                </div>
                :
                <></>
              }

              {
                startProgress 
                ?
                <></>
                :
                <div className='px-3'>
                  <div>
                    <div className='d-flex justify-content-end align-items-end me-2 mb-1'>
                        <Tooltip title="Click for instructions" placement='top'>
                            <a target='_blank' className='font-x-sm' onClick={openLinkExternally} href='https://mailmeteor.com/blog/gmail-export#method-2-how-to-export-gmail-single-emails-or-threads:~:text=entire%20Gmail%20data-,Method%201%3A%20How%20to%20export%20Gmail%20emails%20to%20CSV%20without%20leaving,to%20send%20a%20follow%2Dup%20sequence%20until%20you%20get%20a%20reply.,-Method%202%3A%20How'>
                              <i className="bi bi-google font-sm"></i> Click here to learn how to export your GMail as CSV?
                            </a>
                          </Tooltip>
                      </div>
                    <div className={`drop-zone-wrapper ${ draggover? " drop-zone-drag" : ""}`}>
                      <div className='d-flex flex-column align-items-between'>
                        <div onDrop={onDrop} onDragOver={(e) => {e.preventDefault(); setDraggover(true)}} 
                            onDragLeave={(e) => {e.preventDefault(); setDraggover(false)}}
                            className={`drop-zone drop-zone-innerwrapper`} 
                            onClick={ selectFile }>
                            <i className="bi bi-upload fs-2 text-secondary mb-2"></i>
                            <div className='text-secondary'> Drop or select .CSV file</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>  
              }
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


