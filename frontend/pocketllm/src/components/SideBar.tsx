import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import moment from 'moment'
import axios from 'axios'
import Tooltip from '@mui/material/Tooltip';

import { WorkSpaceMetadata } from '../App'
import { usePort } from '../PortContext'

type SideBarProps = {
    workSpaceMetadata: WorkSpaceMetadata[];
    curWorkSpaceID: string | null
    setCurWorkSpaceID: (workspaceID: string | null) => void
    setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
    saveWorkSpaceTrigger: React.RefObject<HTMLButtonElement>
    setAfterSaveResetCurWorkspace: React.Dispatch<React.SetStateAction<boolean>>, setAllowUnsave: React.Dispatch<React.SetStateAction<boolean>>
}

export default function SideBar({workSpaceMetadata, curWorkSpaceID, setCurWorkSpaceID, setWorkSpaceMetadata, saveWorkSpaceTrigger,
                                setAfterSaveResetCurWorkspace, setAllowUnsave} : SideBarProps){
    const { port } = usePort()

    const navigate = useNavigate();
    const closeBtn = useRef<HTMLButtonElement>(null);

    const [editNameEnabled, setEditNameEnabled] = useState<boolean[]>([]);
    const [workspaceNames, setWorkspaceNames] = useState<string[]>([])
    const inputRefs = useRef<Array<HTMLInputElement | null>>([])

    useEffect(() => {
        setEditNameEnabled(new Array(workSpaceMetadata.length).fill(false))
        setWorkspaceNames(workSpaceMetadata.map(workspace => workspace.workspaceName || ""))
        // Adjust the length of inputRefs.current
        if (inputRefs.current.length !== workSpaceMetadata.length) {
            inputRefs.current = Array.from({ length: workSpaceMetadata.length }, (_, i) => inputRefs.current[i] || null);
        }
    }, [workSpaceMetadata])

    const toggleEditNameEnabled = (clickedIndex: number) => {
 
        // Check if we're enabling the edit mode for the clicked index
        if (!editNameEnabled[clickedIndex]) {
            setTimeout(() => {
                const inputElement = inputRefs.current[clickedIndex];
                if (inputElement) {
                  inputElement.focus()
                  inputElement.select()
                }
              }, 200);
        }
 
        // Calculate the new state of editNameEnabled
        const newEditNameEnabled = editNameEnabled.map((status, idx) => idx === clickedIndex ? !status : status)

        // Check if all editNameEnabled are false in the new state
        const allDisabled = newEditNameEnabled.every(status => !status)
        if (allDisabled) {
            // Iterate through all workspace names to check for discrepancies
            workspaceNames.forEach((name, index) => {
                const savedName = workSpaceMetadata[index].workspaceName
                const workspaceID = workSpaceMetadata[index].workspaceID
                if (name !== savedName) {
                    // Handle discrepancy
                    (async (workspaceID: string, newName: string) => {
                        const workspace = workSpaceMetadata.find(ws => ws.workspaceID === workspaceID);

                        if (workspace) {
                            if (workspace.isWorkSpaceSaved) {
                                try {
                                    const response = await axios.post(`http://localhost:${port}/update_workspace_name`, {
                                        workspaceID,
                                        newWorkspaceName: newName
                                    });
                    
                                    if (response.data.success) {
                                        // Update the workSpaceMetadata with the new workspace name
                                        setWorkSpaceMetadata(prevMetadata => prevMetadata.map(ws => 
                                            ws.workspaceID === workspaceID ? { ...ws, workspaceName: newName } : ws
                                        ));
                                    }
                                } catch (error) {
                                    console.error('Error updating workspace name:', error);
                                }
                            } else {
                                // If the workspace is not saved, just update the local state of metadata
                                setWorkSpaceMetadata(prevMetadata => prevMetadata.map(ws => 
                                    ws.workspaceID === workspaceID ? { ...ws, workspaceName: newName } : ws
                                ));
                            }
                        }
                    })(workspaceID, name)
                }
            })
        }

        setEditNameEnabled(newEditNameEnabled)
    }
    
    const handleStartWorkSpace = async () => {

        // Check if there is any workspace that is not saved
        const isUnsavedWorkspaceExist = workSpaceMetadata.some(workspace => !workspace.isWorkSpaceSaved);

        if (isUnsavedWorkspaceExist) {
            // Because user attempts to start another workpsace in RAM, both afterSaveResetCurWorkspace and allowUnsave should be true
            setAfterSaveResetCurWorkspace(true)
            setAllowUnsave(true)

            // If there are unsaved workspaces, trigger the save button
            saveWorkSpaceTrigger.current?.click();
        } else {
            // If all workspaces are saved, navigate to Model Cards
            navigate("/ModelCards");
            closeBtn.current?.click();
        }
    };
    
    const handleLoadWorkSpace = async (workspaceID: string) => {
        // Check if any name is currently being edited
        if (editNameEnabled.some(value => value === true)) {
            console.log("An workspace name is being edited, cannot load a new workspace");
            return
        }

        console.log(`Load workspace ${workspaceID} into RAM`)

        // Check if there is any workspace that is not saved
        const isUnsavedWorkspaceExist = workSpaceMetadata.some(workspace => !workspace.isWorkSpaceSaved);

        if (isUnsavedWorkspaceExist) {
            // Because user attempts to load another workpsace in RAM, both afterSaveResetCurWorkspace and allowUnsave should be true
            setAfterSaveResetCurWorkspace(true)
            setAllowUnsave(true)

            // If there are unsaved workspaces, trigger the save button
            saveWorkSpaceTrigger.current?.click();
        } else {
            try {
                const response = await axios.post(`http://localhost:${port}/load_by_id`, { workspaceID });
        
                if (response.data.success) {
                    closeBtn.current?.click()
                    setCurWorkSpaceID(workspaceID)
                    console.log("Model loaded successfully:", response.data)
                } else {
                    console.error("Failed to load workspace:", response.data.msg);
                }
            } catch (error) {
                console.error("Error during workspace load:", error);
            }
        }
    };

    const handleDeleteWorkSpace = async (workspaceID: string) => {
        console.log("Attempting to delete workspace with ID:", workspaceID)

        const workspace = workSpaceMetadata.find(ws => ws.workspaceID === workspaceID)

        if (!workspace) {
            console.error("Workspace not found:", workspaceID)
            return
        }

        if (!workspace.isWorkSpaceSaved) {
            // If the workspace is completely new or has some modified change
            (async () => {
                const unsavedWorkspace = workspace

                const hasSavedFiles = unsavedWorkspace.documents.some(doc => doc.isSaved)

                if (hasSavedFiles) {
                    console.log(`removing unsaved files from workspace ${unsavedWorkspace.workspaceID}`)

                    // Remove unsaved files and mark workspace as saved
                    const updatedDocuments = unsavedWorkspace.documents.filter(doc => doc.isSaved);
                    const updatedWorkSpaceMetadata = workSpaceMetadata.map(workspace => 
                        workspace.workspaceID === unsavedWorkspace.workspaceID
                            ? { ...workspace, documents: updatedDocuments, isWorkSpaceSaved: true }
                            : workspace
                    )
                    setWorkSpaceMetadata(updatedWorkSpaceMetadata)
                } else {
                    console.log(`Delete new workspace ${unsavedWorkspace.workspaceID}`)

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
            })()
        } else {
            // Delete an existing saved & unmodified workspace
            try {
                const response = await axios.post(`http://localhost:${port}/delete_by_id`, { workspaceID });
        
                if (response.data.success) {
                    console.log("Workspace deleted successfully:", response.data)
    
                    // Remove the workspace with the given workspaceID
                    setWorkSpaceMetadata(prevMetadata => {
                        return prevMetadata.filter(md => md.workspaceID !== workspaceID);
                    })


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
                } else {
                    console.error("Failed to delete workspace:", response.data.msg);
                }
            } catch (error) {
                console.error("Error during workspace deletion:", error);
            }
        }
    };

    const handleExportWorkSpace = (workspaceID: string) => {
        const workspace = workSpaceMetadata.find(ws => ws.workspaceID === workspaceID);
        if (!workspace) {
            console.error("Workspace not found:", workspaceID);
            return;
        }

        // A workspace is considered new if it was never saved or it's saved and modified
        const isWorkspaceNew = !workspace.isWorkSpaceSaved

        // Invoke Electron's save dialog
        window.electron.invoke('show-save-dialog').then(filePath => {
            if (!filePath) {
                console.log('Export dialog was canceled');
                return;
            }
            console.log('Workspace will be exported to:', filePath);
    
            // Prepare export data based on the workspace state
            const exportData = isWorkspaceNew ? 
                { filePath, workspaceID, workspaceName: workspace.workspaceName, currentModel: workspace.model_info } :
                { filePath, workspaceID };
    
            // Select endpoint based on the workspace state
            const endpoint = isWorkspaceNew ? '/export_new_workspace' : '/export_by_id';
    
            axios.post(`http://localhost:${port}${endpoint}`, exportData)
                .then(response => {
                    console.log('Workspace exported successfully:', response.data);
                })
                .catch(error => {
                    console.error('Error during model export:', error);
                });
        })
        .catch(err => {
            console.error('Error showing save dialog', err);
        });
    };

    const handleImportWorkSpace = () => {
        window.electron.send('open-folder-dialog')

        window.electron.once('selected-folder', (directoryPath: string) => {
            console.log('Directory chosen:', directoryPath)
            
            axios.post(`http://localhost:${port}/import_workspace`, { directoryPath })
            .then(response => {
                console.log('Workspace imported successfully:', response.data)

                const importedMetadata = {
                    ...response.data.metadata,
                    isWorkSpaceSaved: true // Set the isWorkSpaceSaved to true
                }

                setWorkSpaceMetadata(prevMetadata => [...prevMetadata, importedMetadata])
            })
            .catch(error => {
                console.error('Error during workspace import:', error);
            });
        })
    };

  return (
    <>
    <button className="btn btn-general no-drag" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasWithBothOptions" aria-controls="offcanvasWithBothOptions">
        <i className="bi bi-layout-sidebar"></i>
    </button>

    <div className="offcanvas offcanvas-start" data-bs-scroll="true" tabIndex={-1} id="offcanvasWithBothOptions" aria-labelledby="offcanvasWithBothOptionsLabel">
        <div className="offcanvas-header d-flex justify-content-end">
            <button type="button" className="btn-close no-drag font-sm" ref={closeBtn}
                data-bs-dismiss="offcanvas" aria-label="Close"
                style={{display: "none"}}
            >
            </button>
        </div>
        <div className="offcanvas-body font-sm">
            <div className='d-flex mb-3'>
                <button className='btn btn-general me-2 d-flex border border-secondary-subtle align-items-center w-100'
                    onClick={()=>handleStartWorkSpace()}
                >
                    <i className="bi bi-plus-circle fs-5 me-2"></i>
                    <div className='font-sm'>Start a new workspace</div>
                </button>
                <button onClick={()=>handleImportWorkSpace()} className='btn btn-general d-flex border border-secondary-subtle align-items-center'>
                    <i className="bi bi-cloud-plus fs-5 me-2"></i>
                    <div className='font-sm'>Import</div>
                </button>
                
            </div>

            {
                workSpaceMetadata.map((workspace, index) => (
                    <div 
                    key={workspace.workspaceID}
                    className={`position-relative btn btn-general2 py-2 w-100 rounded-2 d-flex font-sm justify-content-between align-items-center mb-1 ${curWorkSpaceID === workspace.workspaceID  ? 'bg-secondary' : ''} bg-opacity-50`}>
                    {
                        curWorkSpaceID === workspace.workspaceID 
                        ?
                        <Tooltip title="Current work space" placement='right'>
                            <div className='sidebar-curent-select'>
                                <i className="bi bi-caret-right-fill"></i>
                            </div>
                        </Tooltip>
                        :
                        <></>
                    }
                    
                    <div 
                        className='text-start w-100 position-relative' 
                        onClick={() => handleLoadWorkSpace(workspace.workspaceID)}
                    >
                        <form className='d-flex' onSubmit={(e)=>{console.log("handle name edit here"); e.preventDefault(); toggleEditNameEnabled(index)}}> 
                        {/* handle edit name by enter with form on submit */}
                            <input  
                                    ref={el => inputRefs.current[index] = el}
                                    className='mb-2 bg-transparent border-0 history-item' 
                                    value={workspaceNames[index] || ""}
                                    readOnly={!editNameEnabled[index]} 
                                    onChange={(e) => setWorkspaceNames(prevNames => prevNames.map((name, idx) => idx === index ? e.target.value : name))}
                                    style={{width: "fit-content", maxWidth: "200px"}}
                            />
                        </form>
    
                        <div className='d-flex font-x-sm mt-1 text-light-emphasis'>
                            <div> {`${ workspace.documents.some(doc => doc.isSaved) ?  'Last saved: ' + moment.utc(workspace.last_modified).fromNow() : 'Not saved'}`} </div>
                            <div className='ms-2 text-secondary'>{workspace.isWorkSpaceSaved ? '' : '* Changes not saved'}</div>
                        </div>
                    </div>
                    <div className='d-flex'>
                        <Tooltip title="Edit name" placement='top'>
                            <i className="btn btn-general p-1 bi bi-pen fs-6" onClick={() => toggleEditNameEnabled(index)}></i>
                        </Tooltip>
                        
                        <Tooltip  title={workspace.documents.some(doc => doc.isSaved) ?  `${workspace.isWorkSpaceSaved ? 'Export workspace' : 'Export changed workspace'}` : 'Export new workspace'}
                                  placement='top' onClick={() => handleExportWorkSpace(workspace.workspaceID)}>
                            <i className="btn btn-general p-1 bi bi-download mx-2 fs-6"></i>
                        </Tooltip>
                        
                        <Tooltip title={workspace.documents.some(doc => doc.isSaved) ?  `${workspace.isWorkSpaceSaved ? 'Delete workspace' : 'Undo unsaved change'}` : 'Delete new workspace'}
                                 placement='top' onClick={() => handleDeleteWorkSpace(workspace.workspaceID)}>
                            <i className="btn btn-general p-1 bi bi-trash3 fs-6"></i>
                        </Tooltip>
                        
                    </div>
                </div>
                ))
            }
        </div>
    </div>
    </>
    
  )
}
