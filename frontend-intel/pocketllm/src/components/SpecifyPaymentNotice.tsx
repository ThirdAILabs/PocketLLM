type SpecifyPaymentNoticeProps = {
  noticeType : String,
  noticeInfo : String,
}

export default function SpecifyPaymentNotice({noticeType, noticeInfo}: SpecifyPaymentNoticeProps) {
  return (
    <div className='summerize-warning d-flex justify-content-center'>
        <div className='bg-white rounded-3 border border-light-subtle font-sm p-3 border-shadow'
            style={{width: "fit-content", maxWidth: "70%"}}
        >
          {
            noticeType == "warning" ?
            <i className="bi bi-exclamation-circle-fill text-warning me-2"></i>
            :
            noticeType == "loading" ?
            <i className="bi bi-hourglass-top"></i>
            :
            <i className="bi bi-check-circle-fill text-success me-2"></i>
          }
            
            {noticeInfo}
        </div>
        
    </div>
  )
}