import { useState, useRef } from 'react'
import { Tooltip } from '@mui/material'
import SpecifyCouponNotice from "./SpecifyCouponNotice";

type CouponProps = {
  setCurrentUsage: React.Dispatch<React.SetStateAction<number>>,
}

function openLinkExternally(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    window.electron.openExternalUrl(e.currentTarget.href);
}

export default function Coupon({setCurrentUsage} : CouponProps) {
    const [coupon, setCoupon] = useState<string>("");
    const [notice, setNotice] = useState(<></>);

    const closeRef = useRef<HTMLButtonElement>(null);

    // giveNotice("sucess", "Success .....")
    function giveNotice(noticeType: String, noticeInfo: String) {
      setNotice(
          <SpecifyCouponNotice noticeType={noticeType} noticeInfo={noticeInfo}/>
      )
      setTimeout(()=>{
          setNotice(<></>);
      }, 1500)
    }

    const applyCoupon = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();

      const trimmedCoupon = coupon.trim()

      // Check if the coupon code matches and the current date is before February 1, 2024
      const currentDate = new Date();
      const expiryDate = new Date('2024-02-01T00:00:00');

      if (trimmedCoupon === 'THIRDAI-FREE-USAGE-COUPON' && currentDate < expiryDate) {
        setCurrentUsage(currentUsage => Math.max(currentUsage - 100, 1));
        giveNotice("sucess", "Congrats")
        setTimeout(() => {closeRef.current?.click(); setCoupon('')}, 2000)
      } else {
        giveNotice("warning", "The coupon is either invalid or expired.")
      }
    }

    return (
      <div className="modal fade" id="couponModal" tabIndex={-1} aria-labelledby="exampleModalLabel" aria-hidden="true">
          <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                  <div className="modal-header border-0 ">
                      <button type="button" ref={closeRef} className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div className="modal-body">
                      <Tooltip title="Join community to get referral code!" placement="top">
                        <button className='no-drag btn border-0 bg-transparent mt-1 p-0 ms-4'>
                          <a target='_blank' onClick={openLinkExternally} href='https://discord.gg/thirdai'>
                            <i className="bi bi-discord fs-5" style={{color: "#7289da"}}></i>
                          </a>
                        </button>
                      </Tooltip>
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
                              onClick={applyCoupon}
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
