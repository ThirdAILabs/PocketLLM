
import * as React from 'react';
import { v4 as uuidv4 } from 'uuid'
import Tooltip from '@mui/material/Tooltip';
import useTelemetry from '../hooks/useTelemetry'
import { usePort } from '../PortContext'
import ProgressBar from './ProgressBar';
import { WorkSpaceMetadata } from '../App'
import { ModelDisplayInfo } from '../App'
import FileDropbox from './UrlFileDropbox';

type LoadUrlProps = {
  curWorkSpaceID: string|null,
  setCurWorkSpaceID: React.Dispatch<React.SetStateAction<string|null>>,
  setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
  currentModel: ModelDisplayInfo | null,
  setCurrentUsage: React.Dispatch<React.SetStateAction<number>>
}

export default function LoadUrl({curWorkSpaceID, setWorkSpaceMetadata, setCurWorkSpaceID, currentModel, setCurrentUsage}: LoadUrlProps) {
  const { port } = usePort()
  const closeBtn = React.useRef<HTMLButtonElement>(null);
  const [startProgress, setStartProgress] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [url, setUrl] = React.useState<string>('');
  const [urls, setURLs] = React.useState<Array<string>>([]);
  // const [depth, setDepth] = React.useState<number>(1);

  // For telemetry
  const recordEvent = useTelemetry()

  const handleClose = () => {
    closeBtn.current?.click();
  };

  const handleAddURL = (e : React.FormEvent)=> {
    e.preventDefault();
    setURLs([...urls, url]);
    setUrl('');
  }

  const handleDeleteURL = (urlToDelete: string) => {
    setURLs(urls.filter(url => url !== urlToDelete))
  }

  const handleLoadUrl = () => {
    const ws = new WebSocket(`ws://localhost:${port}/url_train`)
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ urls }))
      setStartProgress(true);

      setCurrentUsage(prevUsage => prevUsage + 5)

      recordEvent({
        UserAction: `Upload ${urls.length} urls`,
        UIComponent: 'URL CSV drop area',
        UI: 'LoadURL',
    })
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setProgress(data.progress);
      console.log(`${data.progress}% - ${data.message}`)

      // Handle the received data (e.g., display progress or error messages)
      if (data.complete === true) {
        if (curWorkSpaceID === null) {
          // Create a new workspace
          const newWorkSpaceID = uuidv4()   // Generate a new unique workspace ID
          setCurWorkSpaceID(newWorkSpaceID) // Set the current workspace ID

          const selectedFiles = urls.map(url => ({
            filePath: url,
            fileName: url,
            fileSize: 5, // This is only an estimate
            isSaved: false,
            uuid: uuidv4(),
          }));

          const newWorkSpaceMetadata = {
              workspaceID: newWorkSpaceID,
              workspaceName: urls[0],
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
          const selectedFiles = urls.map(url => ({
            filePath: url,
            fileName: url,
            fileSize: 5, // This is only an estimate
            isSaved: false,
            uuid: uuidv4(),
          }));

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
          setUrl("");
          setURLs([])
          handleClose();
          setStartProgress(false)
          setProgress(0)
      }, 500);
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error)
      setStartProgress(false)
    }

    ws.onclose = () => {
      console.log('WebSocket connection closed')
      setStartProgress(false)
    }
  }

  

  return (
    <>
      <Tooltip title="URL">
        <button onClick={(_) => 
                        recordEvent({
                            UserAction: 'Click',
                            UIComponent: 'add-URL button',
                            UI: 'LoadUrl',
                })}  
                type="button" 
                className="btn btn-general mx-1 h-100" 
                data-bs-toggle="modal" 
                data-bs-target="#urlModal">
              <i className="bi bi-link-45deg font-lg"></i>
              {/* <div className='font-sm'>Url</div> */}
        </button>
      </Tooltip>


      <div className="modal fade" id="urlModal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header border-0 ">
                <button type="button" ref={closeBtn} className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"></button>
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
                  <FileDropbox setURLs={setURLs}/>
                </div>
                
                }
              <form className='d-flex px-3 mt-4 mb-3 align-items-end' onSubmit={(e)=>handleAddURL(e)}>
                <div className='w-100'>
                  {/* <div className='font-x-sm text-start ms-1'>URL</div> */}
                  
                  <input 
                      className='form-control font-sm' 
                      type='url'
                      placeholder='https://' 
                      style={{maxHeight: "30px"}}
                      value={url}
                      onChange={(e)=> setUrl(e.target.value)}
                      />
                </div>

                {/* <div className='ms-1'>
                  <div className='ms-1 d-flex align-items-end'>
                    <div className='font-x-sm text-start'>Depth</div>
                    <Tooltip title="1 means include current link and links current link points to" placement='top'>
                      <i className="bi bi-question-circle ms-1 font-sm cursor-pointer"></i>
                    </Tooltip>
                    
                  </div>
                  <input 
                    className='form-control font-sm text-center' 
                    type='number'
                    style={{maxHeight: "30px", minWidth: "40px"}}
                    value={depth}
                    onChange={(e)=> setDepth(parseInt(e.target.value))}
                    />
                </div> */}
                
                <button className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                    type='submit'
                    style={{maxHeight: "30px", minWidth: "100px"}}
                >
                    Add URL
                </button>
              </form>
            {
              urls.length == 0 ?
              <></>
              :
              <>
                <div className='p-3 text-start font-sm'>
                  <hr className='m-0 mb-2'/>
                  <div className='d-flex font-x-sm'>Added URLs</div>
                  <div className='p-2' style={{maxHeight: "200px", overflowY: "auto"}}>
                    {
                      urls.map((link)=>{return(
                        <div key={uuidv4()} className='row align-items-center w-100'>
                          <div className='col-9 url-scroll'>
                            {link}
                          </div>
                          <div className='col-2'></div>
                          <button className='btn col-1' onClick={() => handleDeleteURL(link)}>
                              <i className="bi bi-x-circle-fill text-secondary"></i>
                          </button>
                        </div>
                        
                      )})
                    }
                  </div>
                  
                  <hr className='m-0 mt-2'/>
                </div>
                <div className='d-flex justify-content-center'>
                  <button 
                    onClick={()=>setURLs([])}
                    className='btn bg-secondary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1 mt-2 mb-4' 
                    style={{maxHeight: "30px", minWidth: "100px"}}
                    >
                      Clear all
                  </button>
                  <button 
                    className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1 mt-2 mb-4' 
                    style={{maxHeight: "30px", minWidth: "100px"}}
                    onClick={handleLoadUrl}
                    >
                      Load to workspace
                  </button>
                </div>
                   
              </>
              
            }
                  <div className="font-x-sm mt-4 text-secondary">Free-tier users are limited to 200 URLs per index.</div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}


