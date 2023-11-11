import React, { useState } from 'react'

type AppUpdaterProps = {
  trigger: React.RefObject<HTMLButtonElement>;
}

export default function AppUpdater({trigger}: AppUpdaterProps) {
    const [updateStatus, setUpdateStatus] = useState(0); // 0: not updated, 1: updating, 2: update complete

  return (
    <>
        <button ref={trigger} type="button" className='btn btn-general mx-1 mt-5'  
          data-bs-toggle="modal" data-bs-target="#AppUpdater" 
          style={{display: "none"}}
        >
            <i className="bi bi-mortarboard font-lg"></i>
            <div className='font-sm'>Update trigger</div>
        </button>
        <form className="modal fade" id="AppUpdater" data-bs-backdrop="static" data-bs-keyboard="false" tabIndex={-1} aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header border-0 ">
                        {/* <button type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"></button> */}
                    </div>
                    <div className="modal-body pt-0 font-sm">
                        {
                            updateStatus == 0 ?
                            <>
                                <div className='my-4'>A new version Pocket LLM is available. <br/>Do you want to update right now? </div>
                                <div className='d-flex justify-content-center mb-4'>
                                    <button type="button"
                                            className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                            onClick={()=>{window.electron.acceptUpdate(); setUpdateStatus(1)}}>
                                        Update
                                    </button>
                                    <button type="button" 
                                            className='btn bg-secondary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                            data-bs-dismiss="modal"
                                            onClick={()=>window.electron.denyUpdate()}>
                                        Not Now
                                    </button>
                                </div> 
                            </>
                            :
                            updateStatus == 1 ?
                            <div className='mt-3'>
                                <i className="bi bi-house-up fs-1 text-secondary"></i>
                                <div className='mt-2'>Updating...Please don't close the app.</div>
                            </div>
                            :
                            <div className='py-4'>
                                <i className="bi bi-house-check fs-1 text-success text-opacity-50"></i>
                                <div className='mt-2 mb-4'>
                                    Update complete. Your app is now newest version version.
                                </div>
                                <div className='d-flex justify-content-center mb-4'>
                                    <button type="button" 
                                            className='btn bg-secondary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                            data-bs-dismiss="modal">
                                        Close
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
