import Tooltip from '@mui/material/Tooltip'

interface ChatBotProps {
  message: string
  references: any[]
}

export default function ChatBot({message, references}: ChatBotProps) {
  const isLoading = message === 'Loading...'

  const loadingElem = ()=>{
    return (
      <div className='d-flex'>
        <div className="spinner-grow me-1" style={{width: "5px", height: "5px"}} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <div className="spinner-grow me-1" style={{width: "5px", height: "5px"}} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <div className="spinner-grow" style={{width: "5px", height: "5px"}} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }
  return (
      isLoading
      ?
      loadingElem()
      :
      <div className='d-flex mb-3'>
          <div className='chat-bubble bg-secondary bg-opacity-25 p-3'>
              {message}

            <div className='d-flex flex-column align-items-end'>
              {references && references.map((ref, index) => (
                <div key={index} className='font-x-sm mt-2 text-dark-emphasis'>
                  <a 
                    style={{ color: 'blue', cursor: 'pointer' }}
                    onClick={() => {/* Handle opening reference PDF here */}}
                  >
                    {ref.metadata.filename} - Pages: {ref.metadata.page}
                  </a>
                  {/* Tooltip and icon can be added here */}
                </div>
              ))}
              
              <div className='font-x-sm mt-2 text-dark-emphasis'>
                  <>
                    <a 
                      style={{ color: 'blue', cursor: 'pointer' }} 
                      // onClick={() => openReferencePDF(index)}
                    >
                      {/* {result.result_source.split(/[/\\]/).pop()} */}
                      Pages: 11 - 12
                    </a>
                    <Tooltip title="view PDF" placement='right'>
                      {/* <i className="bi bi-box-arrow-in-up-right cursor-pointer font-sm text-primary ms-1" onClick={()=>openReferencePDF(index)}></i> */}
                      <i className="bi bi-box-arrow-in-up-right cursor-pointer font-sm text-primary ms-1"></i>
                    </Tooltip>
                  </>
              </div>
              <div className='font-x-sm mt-2 text-dark-emphasis'>
                  <>
                    <a 
                      style={{ color: 'blue', cursor: 'pointer' }} 
                      // onClick={() => openReferencePDF(index)}
                    >
                      {/* {result.result_source.split(/[/\\]/).pop()} */}
                      Pages: 11 - 12
                    </a>
                    <Tooltip title="view PDF" placement='right'>
                      {/* <i className="bi bi-box-arrow-in-up-right cursor-pointer font-sm text-primary ms-1" onClick={()=>openReferencePDF(index)}></i> */}
                      <i className="bi bi-box-arrow-in-up-right cursor-pointer font-sm text-primary ms-1"></i>
                    </Tooltip>
                  </>
              </div>
              <div className='font-x-sm mt-2 text-dark-emphasis'>
                  <>
                    <a 
                      style={{ color: 'blue', cursor: 'pointer' }} 
                      // onClick={() => openReferencePDF(index)}
                    >
                      {/* {result.result_source.split(/[/\\]/).pop()} */}
                      Pages: 11 - 12
                    </a>
                    <Tooltip title="view PDF" placement='right'>
                      {/* <i className="bi bi-box-arrow-in-up-right cursor-pointer font-sm text-primary ms-1" onClick={()=>openReferencePDF(index)}></i> */}
                      <i className="bi bi-box-arrow-in-up-right cursor-pointer font-sm text-primary ms-1"></i>
                    </Tooltip>
                  </>
              </div>
            </div>
          </div>
      </div>
  )
}
