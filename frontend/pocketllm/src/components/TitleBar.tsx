import { useEffect } from 'react'
import { usePort } from '../PortContext'
import axios from 'axios'

import SideBar from './SideBar'
import GeneralAccountProfile from './GeneralAccountProfile'
import ProgressBar from './ProgressBar'
import { WorkSpaceMetadata } from '../App'
import { SubscriptionPlan } from '../App'

type titleBarProps = {
    workSpaceMetadata: WorkSpaceMetadata[],
    subscribeTrigger: React.RefObject<HTMLButtonElement>;
    saveWorkSpaceTrigger: React.RefObject<HTMLButtonElement>, setAfterSaveResetCurWorkspace: React.Dispatch<React.SetStateAction<boolean>>, setAllowUnsave: React.Dispatch<React.SetStateAction<boolean>>
    curWorkSpaceID: string | null
    setCurWorkSpaceID: (modelID: string | null) => void,
    setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
    user : { email: string, name: string, subscription_plan: SubscriptionPlan  } | null,
    setUser: React.Dispatch<React.SetStateAction<{ email: string, name: string, subscription_plan: SubscriptionPlan  } | null>>,
    currentUsage: number
}

export default function TitleBar({ workSpaceMetadata, subscribeTrigger, saveWorkSpaceTrigger, curWorkSpaceID, setCurWorkSpaceID, setWorkSpaceMetadata,
                                    setAfterSaveResetCurWorkspace, setAllowUnsave,
                                    user, setUser,
                                    currentUsage }:titleBarProps) {
    const { port } = usePort()

    const handleLoginClick = async () => {
        try {
            const response = await axios.post(`http://localhost:${port}/gmail_login`);

            if (response.data.success) {
                const { email, name } = response.data

                const sub_type = await checkSubscriptionStatus(email)

                setUser({ email, name, subscription_plan: sub_type })
            } else {
                console.error("Failed to authenticate:", response.data.msg);
            }
        } catch (error) {
            console.error("Error during Gmail login:", error);
        }
    }

    const handelCloseAppWindow = async () => {
        // Check if there is any workspace that is not saved
        const isUnsavedWorkspaceExist = workSpaceMetadata.some(workspace => !workspace.isWorkSpaceSaved);

        if (isUnsavedWorkspaceExist) {
            // Because user attempts to exit the app, both afterSaveResetCurWorkspace and allowUnsave should be true
            setAfterSaveResetCurWorkspace(true)
            setAllowUnsave(true)

            // If there are unsaved workspaces, trigger the save button
            saveWorkSpaceTrigger.current?.click();
        } else {
            window.electron.send("closeApp")
        }
    }

    async function checkSubscriptionStatus(userEmail: string) {
        try {
          const response = await fetch('https://stripe-backend-endpoint-71a1560918ab.herokuapp.com/check-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: userEmail
            }),
          });
      
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
      
          const { type } = await response.json();
      
          console.log('User Subscription type:', type);
      
          return type;
        } catch (error) {
          console.error('Error:', error);
        }
      }

    useEffect(() => {
        if (port) {
            const autoLogin = async () => {
                try {
                  const response = await axios.post(`http://localhost:${port}/gmail_auto_login`);

                  if (response.data.success) {
                    const { email, name } = response.data;
                    const sub_type = await checkSubscriptionStatus(email)

                    setUser({ email, name, subscription_plan: sub_type });
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
                            Login with Gmail
                        </button>
                    }
                    
                    {
                      (!user || (user && user.subscription_plan === SubscriptionPlan.FREE)) ? (
                        <div className='ms-2 text-start'>
                          <div className='font-x-sm mb-1 ms-3'>Current workspace usage ({Math.floor(Math.min(currentUsage, 200))}mb / 200mb)</div>
                          <div style={{width: "250px"}}>
                            <ProgressBar 
                              progress={Math.floor(Math.min(currentUsage / 200 * 100, 100))} 
                              color={Math.floor(currentUsage / 200 * 100) < 90 ? "secondary bg-opacity-50" : "warning bg-opacity-50"}
                            />
                          </div>
                        </div>
                      ) : (
                        <></>
                      )
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
                    onClick={()=>handelCloseAppWindow()}>
                    <i className="bi bi-x fs-5"></i>
                </button>
                
            </div>
        </div>
        
    </div>
  )
}
