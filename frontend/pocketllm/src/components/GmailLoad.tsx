import { useState } from 'react'
// import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { usePort } from '../PortContext'
import axios from 'axios'

export default function LoadGmail() {
    const { port } = usePort()

    const [loggedIn, setLoggedIn] = useState(false);
    // const [startDate, setStartDate] = useState(new Date());
    // const [endDate, setEndDate] = useState(new Date());
    const [maxEmailNum, setMaxEmailNum] = useState<null | number>(null);
    const [eDownloadNum, setEDownloadNum] = useState(maxEmailNum != null ? maxEmailNum : 0);

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
            ws.send(JSON.stringify({
                user_id: 'me',   
                num_emails: eDownloadNum
            }))
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log(`Progress: ${data.progress}% - ${data.message}`);
        };

        ws.onerror = (error) => {
            console.error("WebSocket Error:", error);
        };

        ws.onclose = (event) => {
            if (event.wasClean) {
                console.log(`Closed cleanly, code=${event.code}, reason=${event.reason}`);
            } else {
                console.error(`Connection died`);
            }
        };
    }

  return (
    <>
        <button type="button" className='btn btn-general mx-1'  data-bs-toggle="modal" data-bs-target="#gmailModal">
            <i className="bi bi-google"></i>
            <div className='font-sm'>Gmail</div>
        </button>

        <form onSubmit={(e)=>e.preventDefault()} className="modal fade" id="gmailModal" tabIndex={-1} aria-hidden="true">
            <div className="modal-dialog">
                <div className="modal-content">
                    <div className="modal-header border-0 ">
                        <button type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div className="modal-body pt-0">
                        {
                            loggedIn ?
                            <div className='p-5 font-sm'>
                                <div className='mb-3'>
                                    Download maximum 
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
                                        Begin Download
                                    </button>
                                </div>

                            </div>
                            :
                            <div className='py-5'>
                                <div className='d-flex mb-2 justify-content-center align-items-center'>
                                    <i className="bi bi-google me-1"></i>
                                    <i className="bi bi-mailbox me-2 font-lg"></i>
                                    <div>Statement</div>
                                </div>
                                <div className='font-sm'>Privacy: Your Gmail data will stay local.</div>
                                <div className='d-flex justify-content-center mt-4'>
                                    <button type="button"
                                            className='btn bg-secondary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                            onClick={ logInGmail } >
                                        Confirm and start loggin with Gmail
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
