import { useEffect } from 'react'
import axios from 'axios'
import { Tooltip } from '@mui/material'

import { usePort } from '../PortContext'
import SideBar from './SideBar'
import GeneralAccountProfile from './GeneralAccountProfile'

import { WorkSpaceMetadata } from '../App'
import { SubscriptionPlan } from '../App'
// import loginLogo from '../assets/web_neutral_sq_SI.svg'

type titleBarProps = {
    workSpaceMetadata: WorkSpaceMetadata[],
    subscribeTrigger: React.RefObject<HTMLButtonElement>;
    saveWorkSpaceTrigger: React.RefObject<HTMLButtonElement>, setAfterSaveResetCurWorkspace: React.Dispatch<React.SetStateAction<boolean>>, setAllowUnsave: React.Dispatch<React.SetStateAction<boolean>>
    curWorkSpaceID: string | null
    setCurWorkSpaceID: (modelID: string | null) => void,
    setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
    user : { email: string, name: string, subscription_plan: SubscriptionPlan  } | null,
    setUser: React.Dispatch<React.SetStateAction<{ email: string, name: string, subscription_plan: SubscriptionPlan  } | null>>,
    currentUsage: number, setCurrentUsage: React.Dispatch<React.SetStateAction<number>>,
}

function openLinkExternally(e: React.MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  window.electron.openExternalUrl(e.currentTarget.href);
}

export default function TitleBar({ workSpaceMetadata, subscribeTrigger, saveWorkSpaceTrigger, curWorkSpaceID, setCurWorkSpaceID, setWorkSpaceMetadata,
                                    setAfterSaveResetCurWorkspace, setAllowUnsave,
                                    user, setUser,
                                    currentUsage, setCurrentUsage }:titleBarProps) {
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
                    {/* {
                        user ?
                        <GeneralAccountProfile user={user} setUser = {setUser} subscribeTrigger={subscribeTrigger} setCurrentUsage = {setCurrentUsage}/>
                        :
                        <button onClick={handleLoginClick} className='btn border-0 p-0 bg-white text-secondary font-sm ms-2 no-drag btn-general2'>
                            <img src={loginLogo} placeholder='log in with Gmail'/>
                        </button>
                    } */}

                    <GeneralAccountProfile user={user} setUser = {setUser} subscribeTrigger={subscribeTrigger}  setCurrentUsage = {setCurrentUsage} currentUsage={currentUsage} handleLoginClick = {handleLoginClick}/>
                   
                    
                    <Tooltip title="Join Community & get FREE usage coupons!" placement='right'>
                      <button className='no-drag btn border-0 bg-transparent mt-1 p-0 ms-4'>
                        <a target='_blank' onClick={openLinkExternally} href='https://discord.gg/thirdai'>
                          <i className="bi bi-discord fs-5" style={{color: "#7289da"}}></i>
                        </a>
                      </button>
                    </Tooltip>
                    

                    
                    
                    
                    
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
