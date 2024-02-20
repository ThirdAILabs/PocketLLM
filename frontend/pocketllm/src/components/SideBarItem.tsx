import React, { useEffect, useRef, useState } from 'react'

import { Tooltip } from '@mui/material'
import ListItem from '@mui/material/ListItem'

import { WorkSpaceMetadata } from '../App'

const drawerWidth = 290

type SideBarItemProps = {
    collapseId: string,
    logo: string,
    workspaceName: string,
    CreateWorkspaceComponent: React.ReactNode,
    createButtonComponent: React.ReactNode,
    workspaces: WorkSpaceMetadata[], curWorkSpaceID: string | null,
    handleClickLoadWorkspace: (workspaceID: string) => Promise<void>,
    handleClickExportWorkSpace: (workspaceID: string) => void,
    handleClickDeleteWorkspace: (workspaceID: string) => Promise<void>
}

export default function SideBarItem({collapseId, logo, workspaceName, CreateWorkspaceComponent, createButtonComponent, workspaces, curWorkSpaceID, 
                                    handleClickLoadWorkspace, handleClickExportWorkSpace, handleClickDeleteWorkspace
} : SideBarItemProps) {

    const [collapse, setCollapse] = useState(true)
    const [chevron, setChevron] = useState("right")
    const collapseRef = useRef<HTMLDivElement>(null)

    const handleCollapse = () =>{
        collapseRef.current?.classList.toggle("show")
        setCollapse(!collapse)
    }

    useEffect(()=>{
        if (collapse) {
            setChevron("right");
        } else {
            setChevron("down");
        }
    }, [collapse])
  
    return (
        <div className='w-100 font-sm'>
            
            <button 
                className={`btn btn-general2 bg-transparent w-100 rounded-0 mt-2 font-sm text-start px-3`}
                type="button"
                onClick={handleCollapse}
            >
                <div className='d-flex justify-content-between align-items-center'>
                    <div className='d-flex'>
                        <i className={`bi text-secondary me-2 bi-chevron-${chevron}`}></i>
                        <div>{`${logo} ${workspaceName} Workspace`}</div>
                    </div>

                    {createButtonComponent}

                </div>

            </button>
            
            {CreateWorkspaceComponent}
            
            <div className="collapse" id={`${collapseId}`} ref={collapseRef}>
            
                {workspaces.map((workspace) => (
                    <ListItem key={workspace.workspaceID} disableGutters={true}  onClick={() => handleClickLoadWorkspace(workspace.workspaceID)}>
                        <div className='position-relative px-2' style={{width: `${drawerWidth}px`}}>
                            <div className={`position-relative btn btn-general2 w-100 ps-3 rounded-3 d-flex font-sm justify-content-between align-items-center cursor-pointer ${workspace.workspaceID === curWorkSpaceID ? "bg-secondary bg-opacity-10" : ""}`}>
                                
                                <div className='text-start w-100 position-relative'>
                                    <form className='d-flex'>
                                        <input  
                                            className='bg-transparent border-0 history-item'
                                            style={{width: "fit-content", maxWidth: "200px"}}
                                            value={workspace.workspaceName}
                                            readOnly={true}
                                            onChange={(_) => {}}
                                        />
                                    </form>
                                </div>
                                <div className='d-flex'>
                                    {
                                        // Gmail Workspace cannot be exported for security
                                        workspaceName === "Gmail" 
                                        ?
                                        <></>
                                        :
                                        <Tooltip title='Export workspace' placement='top'>
                                            <i className="btn btn-general p-1 bi bi-download mx-2 font-sm" onClick = {(e)=>{e.stopPropagation(); handleClickExportWorkSpace(workspace.workspaceID) }}/>
                                        </Tooltip>
                                    }
                                    
                                    
                                    <Tooltip title='Delete workspace' placement='top'>
                                        <i className="btn btn-general p-1 bi bi-trash3 font-sm" onClick= {(e)=>{e.stopPropagation(); handleClickDeleteWorkspace(workspace.workspaceID) }} />
                                    </Tooltip>
                                </div>
                            </div>
                        </div>
                        
                    </ListItem>
                ))}

            </div>

        </div>
  )
}
