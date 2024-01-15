import axios from 'axios'
import React from 'react'
import { usePort } from '../PortContext'
import { SubscriptionPlan } from '../App'
import Coupon from './Coupon'
import ProgressBar from './ProgressBar'
import { Tooltip } from '@mui/material'

type AccountProps = {
    user : { email: string, name: string, subscription_plan: SubscriptionPlan } | null,
    currentUsage: number,
    subscribeTrigger: React.RefObject<HTMLButtonElement>,
    setUser: React.Dispatch<React.SetStateAction<{ email: string, name: string, subscription_plan: SubscriptionPlan  } | null>>,
    handleLoginClick: () => {},
    premiumEndDate: Date | null, setPremiumEndDate: React.Dispatch<React.SetStateAction<Date | null>>,
}

const calculateDaysLeft = (endDate: Date) => {
    if (!endDate) return 0;
  
    const today = new Date();
    const timeDiff = endDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
    return Math.max(daysLeft, 0); // Ensure it doesn't go negative
}

export default function GeneralAccountProfile({user, currentUsage, subscribeTrigger, setUser, handleLoginClick,
                                                premiumEndDate, setPremiumEndDate } : AccountProps) {
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
                                <div className='d-flex align-items-start'>
                                    {
                                        premiumEndDate && new Date() <= premiumEndDate 
                                        ?
                                        <div className='font-x-sm mb-1 ms-3'>
                                            Premium days left: {calculateDaysLeft(premiumEndDate)}
                                        </div>
                                        :
                                        <>
                                            <div className='font-x-sm mb-1 ms-3'>Monthly Premium Credits left: {200 - Math.floor(Math.min(currentUsage, 200))}mb</div>
                                            <Tooltip title="Free-tier users get 200mbs of premium plan usage at the beginning of every month." placement="right">
                                                <i className="bi bi-question-circle p-0 font-x-sm ms-1 cursor-pointer text-primary text-opacity-75"></i>
                                            </Tooltip>
                                        </>
                                    }
                                </div>

                                {
                                    premiumEndDate && new Date() <= premiumEndDate 
                                    ?
                                    <></>
                                    :
                                    <div style={{width: "250px"}}>
                                        <ProgressBar 
                                        progress={Math.floor(Math.min(currentUsage / 200 * 100, 100))} 
                                        color={Math.floor(currentUsage / 200 * 100) < 90 ? "secondary bg-opacity-50" : "warning bg-opacity-50"}
                                        />
                                    </div>
                                }
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
                        <button className="dropdown-item d-flex btn-general2" data-bs-toggle="modal" data-bs-target="#couponModal">
                            <div className='me-2'>Referral</div>
                        </button>
                    </li>
                    <li>
                        <button className="dropdown-item d-flex btn-general2"
                            onClick={()=>{subscribeTrigger.current?.click()}}
                        >
                            <div className='me-2'>Subscribe</div>
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
                            <div className='d-flex align-items-start'>
                                {
                                    premiumEndDate && new Date() <= premiumEndDate 
                                    ?
                                    <div className='font-x-sm mb-1 ms-3'>
                                        Premium days left: {calculateDaysLeft(premiumEndDate)}
                                    </div>
                                    :
                                    <>
                                        <div className='font-x-sm mb-1 ms-3'>Monthly Premium Credits left: {200 - Math.floor(Math.min(currentUsage, 200))}mb</div>
                                        <Tooltip title="Free-tier users get 200mbs of premium plan usage at the beginning of every month." placement="right">
                                            <i className="bi bi-question-circle p-0 font-x-sm ms-1 cursor-pointer text-primary text-opacity-75"></i>
                                        </Tooltip>
                                    </>
                                }
                            </div>
                            
                            {
                                premiumEndDate && new Date() <= premiumEndDate 
                                ?
                                <></>
                                :
                                <div style={{width: "250px"}}>
                                    <ProgressBar 
                                    progress={Math.floor(Math.min(currentUsage / 200 * 100, 100))} 
                                    color={Math.floor(currentUsage / 200 * 100) < 90 ? "secondary bg-opacity-50" : "warning bg-opacity-50"}
                                    />
                                </div>
                            }
                        </div>
                    </li>
                    <div className='d-flex justify-content-center'>
                        <div className='horizontal-line my-2' style={{opacity: "0.3", width: "92%"}}></div>
                    </div>
                    
                    <li>
                        <button className="dropdown-item d-flex btn-general2" data-bs-toggle="modal" data-bs-target="#couponModal">
                            <div className='me-2'>Referral</div>
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

        <Coupon setPremiumEndDate = {setPremiumEndDate}/>
    </div>
  )
}
