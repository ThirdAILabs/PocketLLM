import axios from 'axios'
import React from 'react'
import { usePort } from '../PortContext'

type AccountProps = {
    user : { email: string, name: string },
    subscribeTrigger: React.RefObject<HTMLButtonElement>,
    setUser: React.Dispatch<React.SetStateAction<{ email: string, name: string } | null>>,
}

export default function GeneralAccountProfile({user, subscribeTrigger, setUser} : AccountProps) {
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
            <div className='userHeadshot bg-primary bg-opacity-25'>
                {user.name[0]}
            </div>
            <div className='font-x-sm mx-2'>Subscribed monthly</div>
        </button>

        <ul className="dropdown-menu font-sm mt-1 border-light-subtle border-shadow">
            {/* <li>
                <button className="dropdown-item d-flex btn-general2">
                    <div className='me-2'>Setting</div>
                </button>
            </li> */}
            <li>
                <button className="dropdown-item d-flex btn-general2"
                    onClick={()=>{subscribeTrigger.current?.click()}}
                >
                    <div className='me-2'>Subscription</div>
                </button>
            </li>
            <li>
                <button className="dropdown-item d-flex btn-general2"
                        onClick={()=>{handleLogout()}}>
                    <div className='me-2'>Log out</div>
                    <i className="bi bi-box-arrow-right"></i>
                </button>
            </li>
            
        </ul>
    </div>
  )
}
