import React from 'react'
import { useNavigate } from 'react-router-dom'

import ProgressBar from '../ProgressBar.tsx'
import { useBackendControl } from '../../contexts/BackendControlContext.tsx'

type gmailWorkspaceProgressProps = {
    progress: number,
    gmailWorkspaceProgressRef: React.RefObject<HTMLButtonElement>, gmailWorkspaceCloseRef: React.RefObject<HTMLButtonElement>,
    setCurWorkSpaceID: (modelID: string | null) => void,
}

export default function GmailWorkspaceProgress({progress, gmailWorkspaceProgressRef, setCurWorkSpaceID, gmailWorkspaceCloseRef}: gmailWorkspaceProgressProps) {
    
    const { restartBackend } = useBackendControl()

    const navigate = useNavigate()

    

    const handleClickWorkspacePause = () => {
        
        restartBackend() // restart backend

        navigate('/') // Go to home page

        setCurWorkSpaceID(null)

        gmailWorkspaceCloseRef.current?.click() // Close Gmail progress window
    }

    return (
        <>

            <div    className="modal fade" id="GmailWorkspaceProgress" tabIndex={-1} aria-labelledby="GmailWorkspaceProgressCreateLabel" aria-hidden="true"
                    data-bs-backdrop="static">
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-body pt-0">
                            <button style={{display: 'none'}} data-bs-toggle="modal" data-bs-target="#GmailWorkspaceProgress" ref = {gmailWorkspaceProgressRef}/>
                            <button style={{display: 'none'}} type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" ref = {gmailWorkspaceCloseRef}/>

                            <ProgressBar progress={progress} stoppable = {true} handleClickWorkspacePause = {handleClickWorkspacePause}/>
                        </div>

                    </div>
                </div>
            </div>
        </>
    )
}