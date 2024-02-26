import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'

import { Tooltip } from '@mui/material'

import { usePort } from '../contexts/PortContext'
import { WorkSpaceMetadata } from '../App'

type editableNameProps = {
    workspaceName: string,
    workSpaceMetadata: WorkSpaceMetadata[],
    curWorkSpaceID: string | null, setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
}

export default function EditableName({
    workspaceName,
    workSpaceMetadata, curWorkSpaceID, setWorkSpaceMetadata
} : editableNameProps) {

    const { port } = usePort()

    const [name, setName] = useState('')
    const [nameEditable, setNameEditable] = useState(false)
    const nameFieldRef = useRef<HTMLInputElement>(null)

    useEffect(()=>{
        setName(workspaceName)
    }, [curWorkSpaceID])

    const handleChangeName = async ()=>{        
        if (!nameEditable) {
            // begin to edit name
            nameFieldRef.current?.select()
        } else {
            // edit name finished
            const changedName = name.trim()
            if (changedName && changedName != workspaceName) {
                const workspace = workSpaceMetadata.find(ws => ws.workspaceID === curWorkSpaceID)

                if (workspace) {
                    if (workspace.isWorkSpaceSaved) {
                        try {
                            const response = await axios.post(`http://localhost:${port}/update_workspace_name`, {
                                workspaceID: curWorkSpaceID,
                                newWorkspaceName: changedName
                            })
            
                            if (response.data.success) { // Update the workSpaceMetadata with the new workspace name
                                setWorkSpaceMetadata(prevMetadata => prevMetadata.map(ws => 
                                    ws.workspaceID === curWorkSpaceID ? { ...ws, workspaceName: changedName } : ws
                                ))
                            }
                        } catch (error) {
                            console.error('Error updating workspace name:', error)
                        }
                    } else { // If the workspace is not saved, just update the local state of metadata
                        setWorkSpaceMetadata(prevMetadata => prevMetadata.map(ws => 
                            ws.workspaceID === curWorkSpaceID ? { ...ws, workspaceName: changedName } : ws
                        ))
                    }
                }
            }
        }

        setNameEditable(!nameEditable)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (! nameEditable) {
            e.preventDefault()
        } else {
            if (e.key === 'Enter') {
                e.preventDefault()
                handleChangeName()
            }
        }
    }

  return (
    <form className='d-flex position-relative'>
        <input  
                ref={nameFieldRef}
                className='bg-transparent border-0'
                style={{
                    width: "fit-content", 
                    maxWidth: "200px", 
                    fontStyle: nameEditable ? 'italic' : 'normal',
                    color: "black",
                    backgroundColor: "white",
                }}
                readOnly = {!nameEditable}
                value={name}
                onKeyDown={(e)=> handleKeyDown(e)}
                onChange={(e) => {setName(e.target.value)}}
        />
        <Tooltip title="Edit workspace name" placement='top'>
            <i className="btn btn-general p-1 bi bi-pen font-sm editablename-icon" onClick={handleChangeName}/>
        </Tooltip>
    </form>
  )
}