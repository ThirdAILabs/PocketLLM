import React from 'react'

type updateModalProps = {
  trigger: React.RefObject<HTMLButtonElement>;
}

export default function UpdateModal({trigger}: updateModalProps) {
  return (
    <>
        <button ref={trigger} type="button" className='btn btn-general mx-1'  
          data-bs-toggle="modal" data-bs-target="#updateModal" 
          style={{display: "none"}}
        >
            <i className="bi bi-mortarboard font-lg"></i>
            <div className='font-sm'>Update trigger</div>
        </button>
        <form className="modal fade" id="updateModal" tabIndex={-1} aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header border-0 ">
                        <button type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div className="modal-body pt-0 font-sm">
                        <div className='mb-3'>A new version Pocket LLM is available. <br/>Do you want to update right now? </div>
                        <div className='d-flex justify-content-center mb-3'>
                            <button type="button"
                                    className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                    onClick={()=>window.electron.acceptUpdate()}>
                                Update
                            </button>
                            <button type="button" 
                                    className='btn bg-secondary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                    data-bs-dismiss="modal"
                                    onClick={()=>window.electron.denyUpdate()}>
                                Not Now
                            </button>
                        </div>
                       
                    </div>
                </div>
            </div>
        </form>
    </>
  )
}
