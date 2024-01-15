import { useState, useRef } from 'react'
import { Tooltip } from '@mui/material'
import SpecifyCouponNotice from "./SpecifyCouponNotice";

type CouponProps = {
  setPremiumEndDate: React.Dispatch<React.SetStateAction<Date | null>>,
}

function openLinkExternally(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    window.electron.openExternalUrl(e.currentTarget.href);
}

export default function Coupon({setPremiumEndDate} : CouponProps) {
    const [coupon, setCoupon] = useState<string>("");
    const [notice, setNotice] = useState(<></>);

    const closeRef = useRef<HTMLButtonElement>(null);

    // giveNotice("success", "Success .....")
    function giveNotice(noticeType: String, noticeInfo: String) {
      setNotice(
          <SpecifyCouponNotice noticeType={noticeType} noticeInfo={noticeInfo}/>
      )
      setTimeout(()=>{
          setNotice(<></>);
      }, 2000)
    }

    const applyReferral = (e: React.MouseEvent<HTMLButtonElement>) => {

      e.preventDefault();

      const referralCode = coupon.trim()

      window.electron.send('get-user-id')

      window.electron.once('send-user-id', (userID: string) => {
        const userIDs = userID.split(' | ');
        const userMachineHash = userIDs.length === 2 ? userIDs[1] : userIDs[0];

        // Send IPC message to main process to apply the referral code
        window.electron.send('apply-referral', { userMachineHash, referralCode });

        // Listen for response from main process
        window.electron.once('apply-referral-response', (response) => {
            if (response.success) {
                console.log('Referral code applied successfully');
                giveNotice("success", "Referral code applied successfully")

                // Update the premium end date state based on the current value
                setPremiumEndDate(originalPremiumEndDate => {
                  const currentDate = new Date();
                  let newPremiumEndDate;

                  if (originalPremiumEndDate && originalPremiumEndDate > currentDate) {
                      // If the original premium end date is in the future, add 1 month to it
                      newPremiumEndDate = new Date(originalPremiumEndDate);
                      newPremiumEndDate.setMonth(newPremiumEndDate.getMonth() + 1);
                  } else {
                      // If the original premium end date is today or in the past, set it to 1 month from today
                      newPremiumEndDate = new Date();
                      newPremiumEndDate.setMonth(currentDate.getMonth() + 1);
                  }

                  return newPremiumEndDate;
                })

            } else {
                console.error('Error applying referral code:', response.error);
                giveNotice("warning", "You may have already used referral code before or this referral code is invalid.")
            }
        });

      })

    }

    function copyReferralLink(e: React.MouseEvent<HTMLButtonElement>) {
      e.preventDefault();

      window.electron.send('get-user-id')

      window.electron.once('send-user-id', (userID: string) => {
        const userIDs = userID.split(' | ');
        const userMachineHash = userIDs.length === 2 ? userIDs[1] : userIDs[0];

        navigator.clipboard.writeText(`Please Download PocketLLM | a private search product here: https://www.thirdai.com/pocketllm/ Use referral code ${userMachineHash} to get 1 month premium access.`);
        giveNotice("success", "Referral message copied to your clipboard!")

        // Send IPC message to main process to activate the referral code
        window.electron.send('activate-referral', userMachineHash);

        // Listen for response from main process
        window.electron.once('activate-referral-response', (response) => {
            if (response.success) {
                console.log('Referral code activated successfully');

                // start listenining for whether or not new updates
            } else {
                console.error('Error activating referral code:', response.error);
            }
        });
      })
    }

    return (
      <div className="modal fade" id="couponModal" tabIndex={-1} aria-labelledby="exampleModalLabel" aria-hidden="true">
          <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                  <div className="modal-header border-0">
                      <button type="button" ref={closeRef} className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div className="modal-body pt-0">
                    <div className='d-flex ps-3 align-items-center mb-4'>
                        <Tooltip title="Join community to get referral code!" placement="right">
                          <button className='btn border-0 bg-transparent p-0'>
                            <a target='_blank' onClick={openLinkExternally} href='https://discord.gg/thirdai'>
                              <div className='d-flex align-items-center'>
                                <i className="bi bi-discord fs-5" style={{color: "#7289da"}}></i>
                                <div className='font-x-sm ms-2' style={{color: "#7289da"}}>Join Community</div>
                              </div>
                            </a>
                          </button>
                          
                        </Tooltip>
                        
                    </div>
                      
                      <div className='d-flex flex-column align-items-center mb-4'>
                        <div className='mb-2 fw-bold text-primary text-opacity-75'>1 Referral = 1 Month Premium</div>
                        <div className='font-x-sm mb-3'>For every friend you referred, you get 1 month premium access <br/> when they download the app and use your referral code(click 'Refer a Friend' to obtain)</div>
                        <button className='font-sm btn btn-outline-primary rounded-5' 
                                style={{opacity: "0.75"}}
                                onClick={copyReferralLink}
                                type='button'
                          >
                            Refer a Friend
                        </button>
                      </div>
                      
                      <div className='d-flex px-3 mt-2 mb-4 align-items-end'>
                          <div className='w-100'>
                          <div className='font-x-sm text-start ms-1'>Referral Code</div>
                          
                          <input 
                              className='form-control font-sm' 
                              type='text'
                              style={{maxHeight: "30px"}}
                              value={coupon}
                              onChange={(e)=> setCoupon(e.target.value)}
                              />
                          </div>
                          <button className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                              type='button'
                              style={{maxHeight: "30px", minWidth: "130px"}}
                              onClick={applyReferral}
                          >
                              Apply
                          </button>
                      </div>

                    {notice}
                  </div>
              </div>
          </div>
      </div>
    )
}
