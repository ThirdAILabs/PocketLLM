import { useEffect, useState } from 'react'
import { usePort } from '../PortContext'
import axios from 'axios'

import SideBar from './SideBar'
import GeneralAccountProfile from './GeneralAccountProfile'
import { WorkSpaceMetadata } from '../App'

type titleBarProps = {
    workSpaceMetadata: WorkSpaceMetadata[],
    subscribeTrigger: React.RefObject<HTMLButtonElement>;
    saveWorkSpaceTrigger: React.RefObject<HTMLButtonElement>, setAfterSaveResetCurWorkspace: React.Dispatch<React.SetStateAction<boolean>>, setAllowUnsave: React.Dispatch<React.SetStateAction<boolean>>
    curWorkSpaceID: string | null
    setCurWorkSpaceID: (modelID: string | null) => void,
    setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
}

export default function TitleBar({workSpaceMetadata, subscribeTrigger, saveWorkSpaceTrigger, curWorkSpaceID, setCurWorkSpaceID, setWorkSpaceMetadata,
                                    setAfterSaveResetCurWorkspace, setAllowUnsave}:titleBarProps) {
    const { port } = usePort()
    const [user, setUser] = useState<{ email: string, name: string } | null>(null);

    const handleLoginClick = async () => {
        try {
            const response = await axios.post(`http://localhost:${port}/gmail_login`);

            if (response.data.success) {
                const { email, name } = response.data
                setUser({ email, name })
            } else {
                console.error("Failed to authenticate:", response.data.msg);
            }
        } catch (error) {
            console.error("Error during Gmail login:", error);
        }
    }

    useEffect(() => {
        if (port) {
            const autoLogin = async () => {
                try {
                  const response = await axios.post(`http://localhost:${port}/gmail_auto_login`);

                  if (response.data.success) {
                    const { email, name } = response.data;
                    setUser({ email, name });
                  } else {
                    console.log("Auto-login failed:", response.data.msg);
                  }
                } catch (error) {
                  console.error("Error during auto-login:", error);
                }
              }

              window.electron.on('server-ready', autoLogin)
        }
    }, [port]);

  return (
    <div className="title-bar">
        <div className="d-flex justify-content-between align-items-start m-2">
                <div className='d-flex align-items-center mt-2 ms-2'>
                    <SideBar workSpaceMetadata = {workSpaceMetadata} 
                             curWorkSpaceID = {curWorkSpaceID} 
                             setCurWorkSpaceID = {setCurWorkSpaceID}
                             setWorkSpaceMetadata = {setWorkSpaceMetadata}
                             saveWorkSpaceTrigger = {saveWorkSpaceTrigger} setAfterSaveResetCurWorkspace = {setAfterSaveResetCurWorkspace} setAllowUnsave = {setAllowUnsave}/>
                    {
                        user ?
                        <GeneralAccountProfile user={user} setUser = {setUser} subscribeTrigger={subscribeTrigger}/>
                        :
                        <button onClick={handleLoginClick} className='btn border bg-white border-light-subtle border-shadow text-secondary font-sm ms-2 no-drag btn-general2'>
                            Log in with 
                            <i className="bi bi-google mx-1 bi-login"></i>
                            GMail
                        </button>
                    }
                </div>

            <div className='d-flex justify-content-end align-items-center'>
                <button className='btn btn-general title-functions'
                    onClick={()=>window.electron.send("minimizeApp")}>
                    <i className="bi bi-dash fs-5"></i>
                </button>
                <button className='btn btn-general title-functions mx-1'
                    onClick={()=>window.electron.send("fullscreen")}>
                    <i className="bi bi-app" style={{fontSize: "11px"}}></i>
                </button>
                <button className='btn btn-general title-functions'
                    onClick={()=>window.electron.send("closeApp")}>
                    <i className="bi bi-x fs-5"></i>
                </button>
                
            </div>
        </div>
        
    </div>
  )
}
