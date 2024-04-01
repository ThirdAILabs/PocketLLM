interface ChatBotProps {
  message: string
}

export default function ChatBot({message}: ChatBotProps) {
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
          <div className='chat-bubble bg-secondary bg-opacity-25'>
              {message}
          </div>
      </div>
  )
}
