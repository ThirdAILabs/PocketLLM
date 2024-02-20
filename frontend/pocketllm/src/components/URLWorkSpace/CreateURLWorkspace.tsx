import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'

import { usePort } from '../../contexts/PortContext'
import { WorkSpaceMetadata } from '../../App'
import ProgressBar from '../ProgressBar'
import useTelemetry from '../../hooks/useTelemetry'
import URLDropBox from './UrlFileDropbox';

type createURLWorkspaceProps = {
  setCurWorkSpaceID: (modelID: string | null) => void,
  setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>,
  modalRef: React.RefObject<HTMLDivElement>
}

export default function CreateURLWorkspace(    
  {
    setCurWorkSpaceID,
    setWorkSpaceMetadata,
    modalRef
  } : createURLWorkspaceProps) {

    const [url, setURL] = useState<string>('')
    const [selectedUrls, setSelectedUrls] = useState<Array<string>>([])

    const [progress, setProgress] = useState(0)
    const [startProgress, setStartProgress] = useState(false)

    const { port } = usePort()

    const navigate = useNavigate()

    const closeBtn = useRef<HTMLButtonElement>(null)

    const recordEvent = useTelemetry()

    const createWorkspace = async () => {
        
        // Always first reset neural db before creating a new workspace
        const response = await axios.post(`http://localhost:${port}/reset_neural_db`)
            
        if (response.data.success) {
            setCurWorkSpaceID(null)
        } else {
            console.error("Backend reset failed:", response.data.msg);
        }

        try {
            const ws = new WebSocket(`ws://localhost:${port}/url_train`)
            
            ws.onopen = () => {
                ws.send(JSON.stringify({ urls: selectedUrls }))
                setStartProgress(true)
            
                recordEvent({
                    UserAction: `Upload ${selectedUrls.length} urls`,
                    UIComponent: 'URL CSV drop area',
                    UI: 'LoadURL',
                })
            }
        
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data)
                setProgress(data.progress)
                console.log(`${data.progress}% - ${data.message}`)
        
                if (data.complete === true) {
                    const newWorkSpaceID = uuidv4()
                    setCurWorkSpaceID(newWorkSpaceID)

                    const selectedFiles = selectedUrls.map(url => ({
                        filePath: url,
                        fileName: url,
                        fileSize: 5,        // This is only an estimate
                        isSaved: false,
                        uuid: uuidv4()
                    }))

                    const newWorkSpaceMetadata = {
                        workspaceID: newWorkSpaceID,
                        workspaceName: selectedUrls[0],
                        model_info: {
                            author_name: 'thirdai',
                            model_name: 'Default model',
                        },
                        documents: selectedFiles,
                        last_modified: new Date().toISOString(),
                        isWorkSpaceSaved: false,
                    }

                    setWorkSpaceMetadata(prevMetaData => [...prevMetaData, newWorkSpaceMetadata])
                
                    navigate(`/url/:${newWorkSpaceID}`)

                    setTimeout(() => {
                        setURL("")
                        setSelectedUrls([])
                        setStartProgress(false)
                        setProgress(0)
                        closeBtn.current?.click()
                    }, 500)
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

        } catch (error) {
            console.error('Error:', error);
            setStartProgress(false);
        }
    }

    return (
        
      <div  className="modal fade" id="URLWorkspaceCreate" ref = {modalRef} tabIndex={-1} aria-labelledby="URLWorkspaceCreateCreateLabel" aria-hidden="true"
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
                            <URLDropBox setURLs={setSelectedUrls}/>

                            <form   className='d-flex px-3 mt-4 mb-3 align-items-end' 
                                    onSubmit={(e)=>{
                                        e.preventDefault()

                                        const trimmedUrl = url.trim()

                                        if (trimmedUrl && !selectedUrls.includes(trimmedUrl)) {
                                            setSelectedUrls([...selectedUrls, trimmedUrl])
                                        }

                                        setURL('')
                                    }}>
 
                                <div className='w-100'>
                                
                                    <input  className='form-control font-sm'
                                            type='url'
                                            placeholder='https://'
                                            style={{maxHeight: "30px"}}
                                            value={url}
                                            onChange={(e)=> setURL(e.target.value)}
                                    />
                                </div>
                                
                                <button className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                        type='submit'
                                        style={{maxHeight: "30px", minWidth: "100px"}}
                                >
                                    Add URL
                                </button>
                            </form>

                            {
                                selectedUrls.length > 0 
                                ?
                                    <>
                                    <hr className='my-2'/>
                                    <div className='mb-3'>
                                        <div className='d-flex font-x-sm'>Selected URLs</div>
            
                                        <ul style={{maxHeight: "140px", overflow: "auto"}}>
                                        {
                                            selectedUrls.map((url) => (
                                                <li key={uuidv4()} className="file-item">
                                                {url.length > 50 ? url.slice(0, 50) + '...' : url}
                                                    <button className='btn ms-2' onClick={() => setSelectedUrls(selectedUrls.filter(curURL => curURL !== url))}>
                                                        <i className="bi bi-x-circle-fill text-secondary"></i>
                                                    </button>
                                                </li>
                                            ))
                                        }
                                        </ul>
                                        <div className='d-flex justify-content-center'>
                                            <button 
                                                onClick={()=>setSelectedUrls([])}
                                                className='btn bg-secondary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1 mt-2 mb-4' 
                                                style={{maxHeight: "30px", minWidth: "100px"}}
                                                >
                                                Clear all
                                            </button>
                                            <button 
                                                className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1 mt-2 mb-4' 
                                                style={{maxHeight: "30px", minWidth: "100px"}}
                                                onClick={createWorkspace}>
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
  