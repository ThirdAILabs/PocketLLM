import { useState, useRef, useEffect } from 'react'
// import DatePicker from "react-datepicker";
import { v4 as uuidv4 } from 'uuid'
import "react-datepicker/dist/react-datepicker.css";
import { usePort } from '../PortContext'
import axios from 'axios'
import ProgressBarWithLabel from './ProgressBarWithLabel';
import { ModelDisplayInfo, WorkSpaceMetadata } from '../App';
// import googleLogo from "../assets/web_neutral_rd_na.svg";
import googleContinue from "../assets/web_neutral_sq_ctn.svg";
import Tooltip from '@mui/material/Tooltip';

type LoadGmailProps = {
    setCurWorkSpaceID: React.Dispatch<React.SetStateAction<string|null>>,
    setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
    currentModel: ModelDisplayInfo | null,
    setCurrentUsage: React.Dispatch<React.SetStateAction<number>>
}

export default function LoadGmail({setWorkSpaceMetadata, setCurWorkSpaceID, currentModel, setCurrentUsage}: LoadGmailProps) {
    const { port } = usePort()
    const closeRef = useRef<HTMLButtonElement>(null)
    const [progress, setProgress] = useState(0)
    const [startProgress, setStartProgress] = useState(false);
    const [label, setLabel] = useState("Begin Download");
    const labelRef = useRef<string>(label)
    const [loggedIn, setLoggedIn] = useState(false);
    const [checked, setChecked] = useState(false);
    // const [startDate, setStartDate] = useState(new Date());
    // const [endDate, setEndDate] = useState(new Date());
    const [maxEmailNum, setMaxEmailNum] = useState<null | number>(null);
    const [eDownloadNum, setEDownloadNum] = useState(maxEmailNum != null ? maxEmailNum : 0);

    useEffect(() => {
        labelRef.current = label;
    }, [label])

    const handleEmailCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault()

        setEDownloadNum(e.target.valueAsNumber)
    }

    const logInGmail = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault()
        
        axios.post(`http://localhost:${port}/gmail_auth`)
        .then(response => {
            if (response.data.success) {
                console.log(response.data.msg);
                axios.post(`http://localhost:${port}/gmail_total_emails`)
                .then(response => {
                    console.log('Total number of emails: ', response.data.total_emails)

                    setMaxEmailNum(response.data.total_emails)
                    setLoggedIn(true)
                })
                .catch(error => {
                    console.error("Error during gmail_total_emails:", error);
                })

            } else {
                console.error(response.data.msg);
            }
        })
        .catch(error => {
            console.error("Error during authentication:", error);
        })
    }

    const downloadGmail = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault()

        const ws = new WebSocket(`ws://localhost:${port}/gmail_download_train`);
        
        ws.onopen = () => {
            setStartProgress(true);
            setLabel("Downloading...");
            ws.send(JSON.stringify({
                user_id: 'me',   
                num_emails: eDownloadNum
            }))

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
                        fileName: `Gmail latest ${eDownloadNum}`,
                        filePath: `Gmail latest ${eDownloadNum}`,
                        fileSize: (5.3 / 1000 * eDownloadNum), // This is only an estimate based on: 1000 emails = 5.3MB
                        isSaved: false,
                        uuid: uuidv4(),
                    }
                ]

                const newWorkSpaceMetadata = {
                    workspaceID: newWorkSpaceID,
                    workspaceName: `Gmail latest ${eDownloadNum}`,
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
            // Send delete request to backend
            const response = await axios.post(`http://localhost:${port}/gmail_inbox_delete_credential`);
    
            // Check if the response indicates success
            if (response.data && response.data.success) {
                setLoggedIn(false);
            } else {
                console.warn("Credentials not deleted successfully:", response.data.message);
            }
        } catch (error) {
            console.error("Error deleting credentials:", error);
        }
    }

  return (
    <>
        <Tooltip title="Upcoming">
            <button type="button" 
                // className='btn mx-1 p-0 rounded-circle'  
                className="btn mx-1 h-100"
                // data-bs-toggle="modal" data-bs-target="#gmailModal"
                onClick={(e)=>e.preventDefault()}
            >
                <i className="bi bi-google text-secondary text-opacity-75"></i>
                {/* <img src={googleLogo} placeholder='Gmail'/> */}
            </button>
        </Tooltip>
        
        <form onSubmit={(e)=>e.preventDefault()} className="modal fade" id="gmailModal" tabIndex={-1} aria-hidden="true">
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
                                                onClick={ downloadGmail }
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
                                    <div>Privacy consent</div>
                                </div>
                                <div className='font-sm'>Only selected text data from your emails will be downloaded to this local computer.</div>
                                <div className="form-check font-sm d-flex justify-content-center mt-5">
                                    <input className="form-check-input me-2" type="checkbox" value="" id="flexCheckDefault" 
                                    checked={checked} onClick={()=>setChecked(!checked)}
                                    readOnly
                                    />
                                    <label className="form-check-label" htmlFor="flexCheckDefault">
                                        I agree with the <a target='_blank' href='https://www.thirdai.com/privacy-policy-pocketllm/'>privacy notice</a>
                                    </label>
                                </div>
                                <div className='d-flex justify-content-center mt-2'>
                                    <button type="button"
                                            disabled={!checked}
                                            className='btn btn-sm p-0 border-0 mx-1'
                                            onClick={ logInGmail } 
                                            style={{
                                                opacity: `${!checked? "50%" : "100%"}`
                                            }}
                                    >

                                        <img src={googleContinue} placeholder='Continue with Google'/>
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
