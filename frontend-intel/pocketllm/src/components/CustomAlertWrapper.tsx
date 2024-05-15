import React, { useEffect, useRef } from 'react'

type AlertProps = {
    message: string;
    setMessage: React.Dispatch<React.SetStateAction<string>>;
}

export default function CustomAlertWrapper({message, setMessage}: AlertProps) {
    const trigger = useRef<HTMLButtonElement>(null);
    useEffect(()=>{
      if (message !== "") {
        trigger.current?.click();
      }
    }, [message])

  return (
    <>
    <button ref={trigger} className='btn font-sm btn-general border border-dark-subtle mx-1' 
        data-bs-toggle="modal" data-bs-target="#alert"
        style={{display: "none"}}
    >
        save toggle
    </button>

    <form className="modal fade" id="alert" tabIndex={-1} aria-hidden="true" data-bs-backdrop="static">
        <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-light">
                <div className="modal-header border-0 bg-danger bg-opacity-10">
                    <button type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close" onClick={() => setMessage("")}></button>
                </div>
                <div className="modal-body p-3 pt-0 pb-4 font-sm bg-danger bg-opacity-10">
                    {message}
                </div>
            </div>
        </div>
    </form>

  </>
  )
}
