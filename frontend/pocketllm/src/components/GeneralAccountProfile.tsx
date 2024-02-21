import React, {useEffect} from 'react'
import axios from 'axios'
import { usePort } from '../contexts/PortContext'
import { SubscriptionPlan } from '../App'

type AccountProps = {
    user : { email: string, name: string, subscription_plan: SubscriptionPlan } | null,
    subscribeTrigger: React.RefObject<HTMLButtonElement>,
    setUser: React.Dispatch<React.SetStateAction<{ email: string, name: string, subscription_plan: SubscriptionPlan  } | null>>,
}

export default function GeneralAccountProfile({ user, subscribeTrigger, setUser } : AccountProps) {
    const { port } = usePort()

    const handleLoginClick = async ()=> {
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

                    setUser({ email, name, subscription_plan: sub_type })
                  } else {
                    console.log("Auto-login failed:", response.data.msg)
                  }
                } catch (error) {
                  console.error("Error during auto-login:", error)
                }
              }

              window.electron.on('server-ready', autoLogin)
        }
    }, [port])
    
    return (
        <div className='px-2 dropdown'>

            <div className='d-flex align-items-center bg-transparent rounded-3 p-2 w-100' 
                    // data-bs-toggle="dropdown" 
                    // aria-expanded="false"
            >
                {
                    user ?
                    <div className='w-100 d-flex justify-content-between'>
                        <div className='w-100 d-flex align-items-center'>
                            <div className='userHeadshot bg-primary bg-opacity-25'> {user.name[0]} </div>
                            {
                                user.subscription_plan !== SubscriptionPlan.FREE 
                                ?
                                    (
                                        user.subscription_plan == SubscriptionPlan.PREMIUM ?
                                        <div className='font-x-sm mx-2'>Premium subscription</div>
                                        :
                                        <div className='font-x-sm mx-2'>Supreme subscription</div>
                                    )
                                :
                                    <div className='font-x-sm mx-2'>Unsubscribed</div>
                            }
                        </div>
                        <button className="d-flex btn-general2 bg-transparent align-items-center"
                            style={{minWidth: "110px"}}
                                onClick={()=>{handleLogout()}}>
                            <i className="bi bi-box-arrow-right me-2"></i>
                            <div className='font-sm'>Log out</div>
                        </button>
                    </div>
                    :
                    <>
                        <div className='userHeadshot bg-secondary bg-opacity-25'><i className="bi bi-person-dash"/></div>
                        <div className='font-sm mx-2' style={{ cursor: 'pointer' }}  onClick={()=>{handleLoginClick()}}>Click to login</div>
                    </>
                }
                
            </div>

            <ul className="dropdown-menu font-sm mt-1 border-light-subtle border-shadow">
                {
                    user 
                    ?
                    <>
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
                    <li>
                        <button className="dropdown-item d-flex btn-general2"
                                onClick={()=>{handleLoginClick()}}>
                            <div className='me-2'>Sign in with Gmail</div>
                        </button>
                    </li>
                }                
            </ul>
        </div>
  )
}
