import { useState, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import "react-datepicker/dist/react-datepicker.css";
import useTelemetry from '../hooks/useTelemetry'
import { usePort } from '../PortContext'
import axios from 'axios'
import ProgressBarWithLabel from './ProgressBarWithLabel';
import { ModelDisplayInfo, WorkSpaceMetadata } from '../App';
import outlookLogo from "../assets/outlook.svg";
import Tooltip from '@mui/material/Tooltip';

type LoadOutLookProps = {
    setCurWorkSpaceID: React.Dispatch<React.SetStateAction<string|null>>,
    setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
    currentModel: ModelDisplayInfo | null,
    setCurrentUsage: React.Dispatch<React.SetStateAction<number>>
}

export default function LoadOutlook({setWorkSpaceMetadata, setCurWorkSpaceID, currentModel, setCurrentUsage}: LoadOutLookProps) {
    const { port } = usePort()
    const closeRef = useRef<HTMLButtonElement>(null)
    const [progress, setProgress] = useState(0)
    const [startProgress, setStartProgress] = useState(false);
    const [label, setLabel] = useState("Begin Download");
    const labelRef = useRef<string>(label)
    const [loggedIn, setLoggedIn] = useState(false);
    // const [startDate, setStartDate] = useState(new Date());
    // const [endDate, setEndDate] = useState(new Date());
    const [maxEmailNum, setMaxEmailNum] = useState<null | number>(null);
    const [eDownloadNum, setEDownloadNum] = useState<number>(0);

    // For telemetry
    const recordEvent = useTelemetry()

    useEffect(() => {
        labelRef.current = label;
    }, [label])

    const handleEmailCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault()

        setEDownloadNum(e.target.valueAsNumber)
    }

    const logInOutlook = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault()
        
        axios.get(`http://localhost:${port}/outlook_auth`)
        .then(response => {
            console.log(`response.data.message: ${response.data.message}`)
            console.log(`response.data.url: ${response.data.url}`)

            // Start polling for authentication status
            const intervalId = setInterval(() => {
                axios.get(`http://localhost:${port}/get_outlook_auth_status`)
                    .then(statusResponse => {
                        if (statusResponse.data.is_authenticated) {
                            console.log("Authentication complete")
                            console.log(`Total number of emails: ${statusResponse.data.total_emails}`)
                            setMaxEmailNum(statusResponse.data.total_emails)
                            setEDownloadNum(statusResponse.data.total_emails)
                            setLoggedIn(true)
                            clearInterval(intervalId);  // Stop polling
                        }
                    })
                    .catch(statusError => {
                        console.error("Error checking authentication status:", statusError);
                    });
            }, 3000);  // Poll every 3 seconds
        })
        .catch(error => {
            console.error("Error during authentication:", error);
        })
    }

    const downloadOutlook = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault()

        const ws = new WebSocket(`ws://localhost:${port}/outlook_download_train`);
        
        ws.onopen = () => {
            setStartProgress(true);
            setLabel("Downloading...");
            ws.send(JSON.stringify({num_emails: eDownloadNum}))

            setCurrentUsage(prevUsage => prevUsage + (5.3 / 1000 * eDownloadNum)) // This is only an estimate based on: 1000 emails = 5.3MB
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setProgress(data.progress);
            console.log(`Progress: ${data.progress}% - ${data.message}`);

            if (data.progress == 100 && labelRef.current == "Downloading...") {
                setTimeout(() => {
                    setLabel("Training...");
                }, 700)
            } else if (data.complete === true && labelRef.current == "Training...") {
                setLabel("Finished")
                setTimeout(()=>{
                    closeRef.current?.click()
                }, 500)

                // Create a new workspace
                const newWorkSpaceID = uuidv4()   // Generate a new unique workspace ID
                setCurWorkSpaceID(newWorkSpaceID) // Set the current workspace ID

                const selectedFiles = [
                    {
                        fileName: `Outlook latest ${eDownloadNum}`,
                        filePath: `Outlook latest ${eDownloadNum}`,
                        fileSize: (5.3 / 1000 * eDownloadNum), // This is only an estimate based on: 1000 emails = 5.3MB
                        isSaved: false,
                        uuid: uuidv4(),
                    }
                ]

                const newWorkSpaceMetadata = {
                    workspaceID: newWorkSpaceID,
                    workspaceName: `Outlook latest ${eDownloadNum}`,
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
                    setLabel("Begin Download");
                }, 700)
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket Error:", error);
            setStartProgress(false);
            setProgress(0);
            setLabel("Begin Download");
        };

        ws.onclose = (event) => {
            setStartProgress(false);
            setProgress(0);
            setLabel("Begin Download");
            if (event.wasClean) {
                console.log(`Closed cleanly, code=${event.code}, reason=${event.reason}`);
            } else {
                console.error(`Connection died`);
            }
        };
    }

    const handleLogoutClick = async () => {
        try {
            setLoggedIn(false);
        } catch (error) {
            console.error("Error deleting credentials:", error);
        }
    }

  return (
    <>
        <Tooltip title="Outlook">
            <button type="button" 
                className="btn btn-general mx-1 h-100"
                onClick={(_) => 
                    recordEvent({
                        UserAction: 'Click',
                        UIComponent: 'add-Outlook button',
                        UI: 'LoadOutlook',
                })}  
                data-bs-toggle="modal" 
                data-bs-target="#outlookModal"
            >
                <img src={outlookLogo} style={{width: '20px'}} placeholder='Outlook'/>
            </button>
        </Tooltip>
        
        <form onSubmit={(e)=>e.preventDefault()} className="modal fade" id="outlookModal" tabIndex={-1} aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header border-0 ">
                        <button ref={closeRef} type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div className="modal-body pt-0">
                        {
                            loggedIn ?
                            <div className='font-sm'>
                                <div style={{width: `fit-content`}}
                                    className='d-flex justify-content-start btn btn-general2 bg-white border border-light-subtle border-shadow text-secondary ms-2 mb-2 rounded-3 p-1 px-2'
                                    onClick={handleLogoutClick}
                                >
                                    <div className='d-flex align-items-center font-sm'>
                                            <i className="btn btn-general p-1 bi bi-box-arrow-right"></i>Log out            
                                    </div>
                                </div>
                                <div className='pt-4 px-5 pb-5'>
                                    <div className='mb-3'>
                                        Download latest 
                                        <input className='mx-2 rounded-3 border border-dark-subtle p-1 px-2' 
                                                type='number' 
                                                defaultValue={maxEmailNum != null ? maxEmailNum : 0} 
                                                max={maxEmailNum != null ? maxEmailNum : 0!} 
                                                min={0} 
                                                onChange={handleEmailCountChange}
                                                style={{maxWidth: "100px"}}
                                        /> 
                                        emails
                                    </div>
                                    {/* <div className='d-flex justify-content-center align-items-center mb-2'>
                                        <div>that are</div>
                                        <select className="form-select form-select-sm border-dark-subtle rounded-3 ms-2 font-sm" aria-label="Small select example" style={{maxWidth: "150px"}}>
                                            <option value="1">All types</option>
                                            <option value="2">Read</option>
                                            <option value="3">Unread</option>
                                        </select>
                                    </div>
                                    <div className='d-flex justify-content-center align-items-center'>
                                        <div>from</div>
                                        <div className='datePicker-wrapper'>
                                            <DatePicker selected={startDate} onChange={(date : Date) => setStartDate(date)} />
                                        </div>
                                        <div>to</div>
                                        <div className='datePicker-wrapper'>
                                            <DatePicker selected={endDate} onChange={(date : Date) => setEndDate(date)} />
                                        </div>
                                    </div> */}
                                    <div className='d-flex justify-content-center mt-4'>
                                        <button type="button"
                                                className='btn bg-secondary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                                onClick={ downloadOutlook }
                                                >
                                            {label}
                                        </button>
                                    </div>
                                    {
                                        startProgress ?
                                        <div className='mt-3'>
                                            <ProgressBarWithLabel progress={progress}/>
                                        </div>
                                        :
                                        <></>
                                    }
                                </div>

                            </div>
                            :
                            <div className='py-5'>
                                <div className='d-flex mb-2 justify-content-center align-items-center'>
                                    <div>Privacy Note</div>
                                </div>
                                <div className='font-sm'>Your emails won't leave this PC. </div>
                                <div className='font-sm'>Search will work without internet. </div>
                                
                                <div className="form-check font-sm d-flex justify-content-center mt-3">
                                    {/* <input className="form-check-input me-2" type="checkbox" value="" id="outlookCheckbox" 
                                    checked={checked} onClick={()=>setChecked(!checked)}
                                    readOnly
                                    />
                                    <label className="form-check-label" htmlFor="outlookCheckbox">
                                        I agree with the <a target='_blank' href='https://www.thirdai.com/privacy-policy-pocketllm/'>privacy notice</a>
                                    </label> */}
                                </div>
                                <div className='d-flex justify-content-center mt-2'>
                                    <button type="button"
                                            className='btn btn-sm p-3 border-0 rounded-2 btn-general mx-1 d-flex'
                                            onClick={ logInOutlook } 
                                            style={{
                                                opacity: "100%",
                                                backgroundColor: "#F2F2F2"
                                            }}
                                    >

                                        <img src={outlookLogo} style={{width: '20px'}} placeholder='Continue with Outlook'/>
                                        <div className='ms-2'>
                                            Continue with outlook
                                        </div>
                                    </button>
                                </div>
                            </div>
                        }
                    </div>
                </div>
            </div>
        </form>

    </>
  )
}
