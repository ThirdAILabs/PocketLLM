import axios from 'axios'
import React from 'react'
import { usePort } from '../PortContext'
import { SubscriptionPlan } from '../App'
import Coupon from './Coupon'
import ProgressBar from './ProgressBar'

type AccountProps = {
    user : { email: string, name: string, subscription_plan: SubscriptionPlan } | null,
    currentUsage: number,
    subscribeTrigger: React.RefObject<HTMLButtonElement>,
    setUser: React.Dispatch<React.SetStateAction<{ email: string, name: string, subscription_plan: SubscriptionPlan  } | null>>,
    setCurrentUsage: React.Dispatch<React.SetStateAction<number>>,
    handleLoginClick: () => {}
}

export default function GeneralAccountProfile({user, currentUsage, subscribeTrigger, setUser, setCurrentUsage, handleLoginClick} : AccountProps) {
    const { port } = usePort()

    const handleLogout = async () => {
        try {
            const response = await axios.post(`http://localhost:${port}/gmail_delete_login_credential`)
            if (response.data.success) {
                setUser(null)
                console.log(response.data.message)
            } else {
                console.error(response.data.message)
            }
        } catch (error) {
            console.error("Error sending logout request:", error)
        }
    }
    
  return (

    <div >

        <button className='no-drag d-flex align-items-center ms-2 btn btn-general2 bg-white rounded-3 border border-light-subtle border-shadow'
            type="button" data-bs-toggle="dropdown" aria-expanded="false">
            {
                user ?
                <>
                <div className='userHeadshot bg-primary bg-opacity-25'>
                    {user.name[0]}
                </div>
                {
                    user.subscription_plan !== SubscriptionPlan.FREE ?
                    (
                        user.subscription_plan == SubscriptionPlan.PREMIUM ?
                        <div className='font-x-sm mx-2'>Premium subscription</div>
                        :
                        <div className='font-x-sm mx-2'>Supreme subscription</div>
                    )
                    :
                    <div className='font-x-sm mx-2'>Unsubscribed</div>
                }
                </>
                :
                <>
                <div className='userHeadshot bg-secondary bg-opacity-25'>
                    <i className="bi bi-person-dash"></i>
                </div>
                
                    <div className='font-x-sm mx-2'>Not logged in</div>
                
                </>
            }
            
        </button>

        <ul className="dropdown-menu font-sm mt-1 border-light-subtle border-shadow">
            {
                user ?
                <>
                    <li>
                    {
                      (user && user.subscription_plan === SubscriptionPlan.FREE) ? (
                        <>
                            <div className='mx-2 mt-3 pb-1 mb-1 text-start'>
                                <div className='font-x-sm mb-1 ms-3'>Current workspace usage ({Math.floor(Math.min(currentUsage, 200))}mb / 200mb)</div>
                                <div style={{width: "250px"}}>
                                    <ProgressBar 
                                    progress={Math.floor(Math.min(currentUsage / 200 * 100, 100))} 
                                    color={Math.floor(currentUsage / 200 * 100) < 90 ? "secondary bg-opacity-50" : "warning bg-opacity-50"}
                                    />
                                </div>
                            </div>
                            <div className='d-flex justify-content-center'>
                                <div className='horizontal-line my-2' style={{opacity: "0.3", width: "92%"}}></div>
                            </div>
                        </>
                        
                      ) : (
                        <></>
                      )
                    }
                    </li>
                    <li>
                        <button className="dropdown-item d-flex btn-general2"
                            onClick={()=>{subscribeTrigger.current?.click()}}
                        >
                            <div className='me-2'>Subscribe</div>
                        </button>
                    </li>
                    <li>
                        <button className="dropdown-item d-flex btn-general2" data-bs-toggle="modal" data-bs-target="#couponModal">
                            <div className='me-2'>Coupon</div>
                        </button>
                    </li>
                    
                    <li>
                        <button className="dropdown-item d-flex btn-general2"
                                onClick={()=>{handleLogout()}}>
                            <div className='me-2'>Log out</div>
                            <i className="bi bi-box-arrow-right"></i>
                        </button>
                    </li>
                </>
                :

                <>
                    <li>
                        <div className='mx-2 mt-3 pb-1 mb-1 text-start'>
                            <div className='font-x-sm mb-1 ms-3'>Current workspace usage ({Math.floor(Math.min(currentUsage, 200))}mb / 200mb)</div>
                            <div style={{width: "250px"}}>
                            <ProgressBar 
                                progress={Math.floor(Math.min(currentUsage / 200 * 100, 100))} 
                                color={Math.floor(currentUsage / 200 * 100) < 90 ? "secondary bg-opacity-50" : "warning bg-opacity-50"}
                            />
                            </div>
                        </div>
                    </li>
                    <div className='d-flex justify-content-center'>
                        <div className='horizontal-line my-2' style={{opacity: "0.3", width: "92%"}}></div>
                    </div>
                    
                    {/* <li>
                        <button className="dropdown-item d-flex btn-general2"
                            onClick={()=>{subscribeTrigger.current?.click()}}
                        >
                            <div className='me-2'>Subscribe</div>
                        </button>
                    </li> */}
                    <li>
                        <button className="dropdown-item d-flex btn-general2" data-bs-toggle="modal" data-bs-target="#couponModal">
                            <div className='me-2'>Coupon</div>
                        </button>
                    </li>
                    <li>
                        <button className="dropdown-item d-flex btn-general2"
                                onClick={()=>{handleLoginClick()}}>
                            <div className='me-2'>Sign in with Gmail</div>
                            {/* <i className="bi bi-google"></i> */}
                        </button>
                    </li>
                    
                </>

            }
            
            
        </ul>

        <Coupon setCurrentUsage = {setCurrentUsage}/>
    </div>
  )
}
