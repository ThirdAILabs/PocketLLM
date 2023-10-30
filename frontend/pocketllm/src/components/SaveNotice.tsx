import React, { useEffect, useState } from 'react'
import axios from 'axios';

import { WorkSpaceMetadata } from '../App'
import { usePort } from '../PortContext'

type SaveProps = {
    trigger: React.RefObject<HTMLButtonElement>;
    workSpaceMetadata: WorkSpaceMetadata[]
    setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
    setCurWorkSpaceID: React.Dispatch<React.SetStateAction<string|null>>,
    afterSaveResetCurWorkspace: boolean,
    allowUnsave: boolean,
}
  
// SaveNotice is triggered when user attemtps to train/load/switch another model while there is one currently in RAM
export default function SaveNotice({trigger, 
                                    workSpaceMetadata, setWorkSpaceMetadata, setCurWorkSpaceID,
                                    afterSaveResetCurWorkspace, allowUnsave}: SaveProps) {
    const { port } = usePort()

    const [unsavedWorkspaceName, setUnsavedWorkspaceName] = useState('')
    
    const handleDontSave = async () => {
        const unsavedWorkspace = workSpaceMetadata.find(workspace => !workspace.isWorkSpaceSaved)

        if (unsavedWorkspace) {
            const hasSavedFiles = unsavedWorkspace.documents.some(doc => doc.isSaved);

            if (hasSavedFiles) {
                // Remove unsaved files and mark workspace as saved
                const updatedDocuments = unsavedWorkspace.documents.filter(doc => doc.isSaved);
                const updatedWorkSpaceMetadata = workSpaceMetadata.map(workspace => 
                    workspace.workspaceID === unsavedWorkspace.workspaceID
                        ? { ...workspace, documents: updatedDocuments, isWorkSpaceSaved: true }
                        : workspace
                )
                setWorkSpaceMetadata(updatedWorkSpaceMetadata)
            } else {
                // Remove entire workspace metadata
                const updatedWorkSpaceMetadata = workSpaceMetadata.filter(workspace => workspace.workspaceID !== unsavedWorkspace.workspaceID)
                setWorkSpaceMetadata(updatedWorkSpaceMetadata)
            }

            // Reset backend and frontend
            try {
                const response = await axios.post(`http://localhost:${port}/reset_neural_db`)

                if (response.data.success) {
                    console.log(response.data.msg)
                    setCurWorkSpaceID(null)
                } else {
                    console.error("Backend reset failed:", response.data.msg)
                }
            } catch (error) {
                console.error("Error during backend reset:", error)
            }
        }
    }

    const handleSaveWorkSpace = async () => {
        const unsavedWorkspace = workSpaceMetadata.find(workspace => !workspace.isWorkSpaceSaved)
    
        if (unsavedWorkspace) {
            try {
                // Prepare the data for the request
                const saveData = {
                    workspaceID: unsavedWorkspace.workspaceID,
                    workspaceName: unsavedWorkspace.workspaceName,
                    currentModel: unsavedWorkspace.model_info,
                };
    
                // Send request to the backend
                const response = await axios.post(`http://localhost:${port}/save_workspace`, saveData);
    
                if (response.data.success) {
                    console.log("Workspace saved successfully");
                    
                    const updatedWorkSpaceMetadata = workSpaceMetadata.map(workspace => {
                        if (workspace.workspaceID === unsavedWorkspace.workspaceID) {
                            return {
                                ...workspace,
                                last_modified: new Date().toISOString(),
                                documents: response.data.documents,
                                isWorkSpaceSaved: true
                            }
                        }
                        return workspace;
                    })
                    setWorkSpaceMetadata(updatedWorkSpaceMetadata)
                    
                    if ( afterSaveResetCurWorkspace ) {
                        setCurWorkSpaceID(null)
                    }
                } else {
                    console.error("Failed to save workspace:", response.data.msg);
                }
            } catch (error) {
                console.error("Error during workspace save:", error);
            }
        } else {
            console.log("No unsaved workspace found.");
        }
    }

    useEffect(() => {
        const unsavedWorkspace = workSpaceMetadata.find(workspace => !workspace.isWorkSpaceSaved)
        
        if (unsavedWorkspace) {
            setUnsavedWorkspaceName(unsavedWorkspace.workspaceName);
        } else {
            setUnsavedWorkspaceName('');
        }
    }, [workSpaceMetadata])

  return (
    <>
    <button ref={trigger} className='btn font-sm btn-general border border-dark-subtle mx-1' 
        data-bs-toggle="modal" data-bs-target="#warnSave"
        style={{display: "none"}}
    >
        save toggle
    </button>

    <form className="modal fade" id="warnSave" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
                <div className="modal-header border-0 ">
                    <button type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div className="modal-body pt-0">
                    <div className='d-flex justify-content-center mb-3'>Do you want to save workspace({unsavedWorkspaceName}) ?</div>
                    <div className='d-flex justify-content-center mb-3'>
                        {
                            allowUnsave
                            ?
                            <button className='btn bg-secondary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                type="button"
                                data-bs-dismiss="modal"
                                onClick={()=>handleDontSave()}
                            >
                                Delete
                            </button>
                            :
                            <></>
                        }
                        
                        <button className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                type="button"
                                data-bs-dismiss="modal"
                                onClick={()=>handleSaveWorkSpace()}
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </form>

  </>
  )
}
