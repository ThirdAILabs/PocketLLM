import { useState, ChangeEvent, FormEvent, useRef } from 'react'
import axios from 'axios'
import { usePort } from '../contexts/PortContext'
import Toast from './Toast'
import { WorkSpaceMetadata } from '../App'
import useTelemetry from '../hooks/useTelemetry'
import Tooltip from '@mui/material/Tooltip'

type TeachProps = {
    curWorkSpaceID: string|null,
    setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
  };

export default function Teach({curWorkSpaceID, setWorkSpaceMetadata}: TeachProps) {
    const { port } = usePort()

    const closeBtn = useRef<HTMLButtonElement>(null)

    const [source, setSource] = useState('')
    const [target, setTarget] = useState('')
    const [toast, setToast] = useState(false)

    // For telemetry
    const recordEvent = useTelemetry()

    function handleToast(){
        recordEvent({
            UserAction: 'Click',
            UIComponent: 'Teach association button',
            UI: 'Teach'
        })
        setToast(true);
        setTimeout(()=>{setToast(false)}, 1900);
    }

    const handleSourceChange = (e: ChangeEvent<HTMLInputElement>) => {
        setSource(e.target.value)
    }

    const handleTargeChange = (e: ChangeEvent<HTMLInputElement>) => {
        setTarget(e.target.value)
    }
    
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()

        try {
            const response = await axios.post(`http://127.0.0.1:${port}/teach`, {
                source_str: source,
                target_str: target,
            })
            
            console.log(response.data)

            if (response.data.success) {
                console.log('teach success')
                
                // Mark the workspace as unsaved
                setWorkSpaceMetadata(prevMetaData => prevMetaData.map(workspace => 
                    workspace.workspaceID === curWorkSpaceID 
                    ? { ...workspace, isWorkSpaceSaved: false } 
                    : workspace
                ))

                setTimeout(() => {
                    closeBtn.current?.click()
                }, 500)

            } else {
                console.log('teach failed')
            }

        } catch (error) {
            console.error('Error:', error)
        }
    }

  return (
    <>
        <Tooltip title="Teach" placement='right'>
            <button onClick={()=>recordEvent({
                                UserAction: 'Click',
                                UIComponent: 'Open-teach button',
                                UI: 'Teach'
                            })}
                    type="button" className='btn btn-general mx-1'  data-bs-toggle="modal" data-bs-target="#teachModal">
                <i className="bi bi-mortarboard font-lg"></i>
            </button>
        </Tooltip>
        

        <form onSubmit={ handleSubmit } className="modal fade" id="teachModal" tabIndex={-1} aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header border-0 ">
                        <button ref = {closeBtn} type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div className="modal-body pt-0">
                        <div className='mb-2 rounded-3 bg-secondary bg-opacity-25 p-2' style={{minHeight: "70px"}}>
                            <input 
                                onChange={handleSourceChange} 
                                className='font-sm w-100 text-align-left bg-transparent border-0' 
                                placeholder='Source concept, e.g. 401(k)'
                                style={{color: "black"}}
                            />
                        </div>
                        <div className='mb-3 rounded-3 bg-secondary bg-opacity-25 p-2' style={{minHeight: "70px"}}>
                            <input 
                                onChange={handleTargeChange} 
                                className='font-sm w-100 text-align-left bg-transparent border-0' 
                                placeholder='Target concept, e.g. Roth IRA'
                                style={{color: "black"}}
                            />
                        </div>

                        <div className='d-flex justify-content-center mb-3'>
                            <button className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                onClick={handleToast}
                                    >
                                Teach association
                            </button>
                        </div>
                        {
                            toast ?
                            <Toast status={1}/>
                            :
                            <></>
                        }
                    </div>
                </div>
            </div>
        </form>

    </>
  )
}
