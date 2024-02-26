import { useRef, useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

import { usePort } from '../../contexts/PortContext'
import { WorkSpaceMetadata } from '../../App'
import { FeatureUsableContext } from '../../contexts/FeatureUsableContext'
import useTelemetry from '../../hooks/useTelemetry'
import googleContinue from "../../assets/web_neutral_sq_ctn.svg"

type createGmailWorkspaceProps = {
    setCurWorkSpaceID: (modelID: string | null) => void,
    setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>,
    modalRef: React.RefObject<HTMLDivElement>,
    gmailWorkspaceProgressRef: React.RefObject<HTMLButtonElement>,
    setGmailWorkspaceProgress: React.Dispatch<React.SetStateAction<number>>,
    gmailWorkspaceCloseRef: React.RefObject<HTMLButtonElement>,
}

export default function CreateGmailWorkspace(
  {
    setCurWorkSpaceID,
    setWorkSpaceMetadata,
    modalRef,
    gmailWorkspaceProgressRef,
    setGmailWorkspaceProgress, gmailWorkspaceCloseRef
  } : createGmailWorkspaceProps) {

    const { port } = usePort()

    const navigate = useNavigate()

    const recordEvent = useTelemetry()

    const { isPremiumAccount } = useContext(FeatureUsableContext)

    const closeBtn = useRef<HTMLButtonElement>(null)

    const [loggin, setLoggin] = useState(false)
    const [trainEmailNum, setTrainEmailNum] = useState(0)
    const [totalEmailNum, setTotalEmailNum] = useState<null | number>(null)
    const [createdWorkspaceID, setCreatedWorkspaceID] = useState<null | string>(null)

    const logInGmail = () => {
        axios.post(`http://localhost:${port}/gmail_auth`)
            .then(response => {
                if (response.data.success) {
                    console.log(response.data.msg)
                    axios.post(`http://localhost:${port}/gmail_total_emails`)
                    .then(response => {
                        if (! isPremiumAccount ) {
                            setTotalEmailNum(Math.min(200, response.data.total_emails))
                        }

                        axios.post(`http://localhost:${port}/save_gmail_workspace`)
                            .then(response => {
                                if (response.data.success) {
                                    const metadata: WorkSpaceMetadata = response.data.metadata

                                    setWorkSpaceMetadata(prevMetadata => [...prevMetadata, {
                                                            ...metadata, isWorkSpaceSaved: true // since loaded from disk, set isWorkSpaceSaved to true
                                                        }])

                                    setCreatedWorkspaceID(metadata.workspaceID)
                                    setLoggin(true)
                                } else {
                                    console.error('Failed to save Gmail workspace:', response.data.msg)
                                }
                            })
                            .catch(error => {
                                console.error("Error during save_gmail_workspace:", error)
                            })

                    })
                    .catch(error => {
                        console.error("Error during gmail_total_emails:", error)
                    })

                } else {
                    console.error(response.data.msg)
                }
            })
            .catch(error => {
                console.error("Error during authentication:", error);
            })
    }

    const createWorkspace = async () => {
        // Always first reset neural db before creating a new workspace
        await axios.post(`http://localhost:${port}/reset_neural_db`)

        const ws = new WebSocket(`ws://localhost:${port}/gmail_initial_download_train`)

        ws.onopen = () => {
            gmailWorkspaceProgressRef.current?.click()

            const initialDownloadNum = isNaN(trainEmailNum) ? 200 : trainEmailNum // Check if trainEmailNum is NaN. If so, set initial_download_num to 200

            ws.send(JSON.stringify({
                user_id: 'me',
                initial_download_num: initialDownloadNum,
                workspaceid: createdWorkspaceID
            }))

            recordEvent({
                UserAction: `Train ${initialDownloadNum} GmailWorkspace`,
                UIComponent: 'Gmail train button',
                UI: 'CreateGmailWorkspace',
            })
        }

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data)
            setGmailWorkspaceProgress(data.progress)
            // console.log(`Progress: ${data.progress}% - ${data.message}`)

            if (data.complete === true) {

                const updatedMetadata: WorkSpaceMetadata = data.metadata

                setWorkSpaceMetadata(prevMetadata => {
                    const index = prevMetadata.findIndex(ws => ws.workspaceID === createdWorkspaceID)
                    if (index !== -1) {
                        return [
                            ...prevMetadata.slice(0, index),
                            { ...updatedMetadata, isWorkSpaceSaved: true },
                            ...prevMetadata.slice(index + 1)
                        ]
                    } else {
                        // If not found, just add the new metadata
                        return [...prevMetadata, { ...updatedMetadata, isWorkSpaceSaved: true }]
                    }
                })
                
                setCurWorkSpaceID(createdWorkspaceID)

                navigate(`/gmail/:${createdWorkspaceID}`)

                setTimeout(()=>{ closeBtn.current?.click() }, 500)

                setTimeout(() => {
                    gmailWorkspaceCloseRef.current?.click()
                    setGmailWorkspaceProgress(0)
                    setLoggin(false)
                }, 700)
            }
        }

        ws.onerror = (error) => {
            console.error("WebSocket Error:", error)
            gmailWorkspaceCloseRef.current?.click()
            setGmailWorkspaceProgress(0)
            setLoggin(false)
        }

        ws.onclose = (event) => {
            gmailWorkspaceCloseRef.current?.click()
            setGmailWorkspaceProgress(0)
            setLoggin(false)

            if (event.wasClean) {
                console.log(`Closed cleanly, code=${event.code}, reason=${event.reason}`)
            } else {
                console.error(`Connection died`);
            }
        };
    }

    return (
        <div  className="modal fade" id="GmailWorkspaceCreate" ref = {modalRef} tabIndex={-1} aria-labelledby="GmailWorkspaceCreateCreateLabel" aria-hidden="true"
              data-bs-backdrop="static">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header border-0 ">
                        <button ref = {closeBtn} onClick={()=>setLoggin(false)} type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"/>
                    </div>

                    <div className="modal-body pt-0">
                        {
                            loggin 
                            ?
                            <div className='font-sm'>
                                <div className='pt-4 px-5 pb-5'>
                                    {
                                        isPremiumAccount
                                        ?
                                        <></>
                                        :
                                        <>Subscribe to Premium to index your entire Gmail</>
                                    }
                                    <div className='mb-3'>
                                        Download latest 
                                        <input  className='mx-2 rounded-3 border border-dark-subtle p-1 px-2' 
                                                type='number'
                                                style={{maxWidth: "100px"}}
                                                defaultValue={totalEmailNum ? totalEmailNum : 0}
                                                max={totalEmailNum ? totalEmailNum : 0!}
                                                min={0} 
                                                onChange={(e)=>{
                                                    e.preventDefault()

                                                    setTrainEmailNum(e.target.valueAsNumber)
                                                }}
                                        /> 
                                        emails
                                    </div>

                                    <div className='d-flex justify-content-center mt-4'>
                                        <button type="button"
                                                className='btn bg-secondary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                                onClick={ (e) => {e.preventDefault(); createWorkspace() }}
                                                >
                                            Create Workspace
                                        </button>
                                    </div>
                                </div>
                            </div>
                            :
                            <div className='py-5'>
                                <div className='d-flex mb-4 justify-content-center align-items-center'>
                                    <div>Privacy notice</div>
                                </div>
                                <div className='font-sm'>Your emails will be downloaded and stay private to this local computer</div>
                                
                                <div className="form-check font-sm d-flex justify-content-center mt-5"/>
                                
                                <div className='d-flex justify-content-center mt-2'>
                                    <button type="button"
                                            className='btn btn-sm p-0 border-0 mx-1'
                                            onClick={ (e) => {e.preventDefault(); logInGmail() }}
                                    >
                                        <img src={googleContinue} placeholder='Continue with Google'/>
                                    </button>
                                </div>
                            </div>
                        }
                    </div>
                </div>
            </div>
        </div>
    )
  }
  