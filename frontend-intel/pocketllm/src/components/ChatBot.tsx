import { useContext, useState } from "react"
import Tooltip from '@mui/material/Tooltip'
import { AIReference } from '../pages/ChatPage'
import { usePort } from '../contexts/PortContext'
import { SetAlertMessageContext } from '../contexts/SetAlertMessageContext'
import useTelemetry from '../hooks/useTelemetry'

interface ChatBotProps {
  message: string
  reference?: AIReference
  previousHumanMessage?: string
}

export default function ChatBot({message, reference, previousHumanMessage}: ChatBotProps) {
  const { port } = usePort()

  const isLoading = message === 'Loading...'

  const setAlertMessage = useContext(SetAlertMessageContext)

  const [clipboard, setClipboard] = useState("clipboard")
  const [thumb, setThumb] = useState("")
  const [thumbDownReason, setThumbDownReason] = useState("none")

  // For telemetry
  const recordEvent = useTelemetry()

  function handleClipboardClick() {
    setClipboard("check-lg")
    copyTextToClipboard()
    setTimeout(()=>{setClipboard("clipboard")}, 2000)
  }

  function handleThumbClick() {
    if (thumb == "" ) {
      setThumb("-fill")
      setThumbDownReason("")
    } else {
      setThumb("")
      setThumbDownReason("none")
    }
  }

  // Telemetry action modified to include the previous human message
  const handleFeedbackClick = (feedbackType: string) => {
    recordEvent({
      UserAction: 'Click',
      UIComponent: feedbackType,
      UI: 'ChatBot',
      data: {
        'ai_answer': message,
        'ai_refs': reference,
        'human_prompt': previousHumanMessage || "No previous human message", // Handle undefined case
      }
    })
    setThumbDownReason("none")
  }

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
  async function openReferencePDF(index: number, pageToOpen: number) {
    function openPDFInNewWindow(pdfURL: string) {
      window.electron.send('open-pdf-window', pdfURL);
    }

    try {
        let response = await fetch(`http://localhost:${port}/highlighted_pdf_from_chat?reference_id=${index}`)
        if (!response.ok)
          throw new Error('Network response was not ok')
        
        let blob = await response.blob()
        let url = URL.createObjectURL(blob)
        openPDFInNewWindow(`${url}#page=${pageToOpen}`)
    } catch (error) {
        console.error('Failed to fetch PDF:', error)
    }
  }

  function openLinkExternally(link: string) {
    window.electron.openExternalUrl(link)
  }

  const copyTextToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message)
      console.log('Text copied to clipboard')
    } catch (err) {
      console.error('Failed to copy: ', err)
      setAlertMessage(`Failed to copy to clipboard: ${err}`)
    }
  }

  return (
      isLoading
      ?
      loadingElem()
      :
      <div className='d-flex mb-3 align-items-center'>
          <div className='chat-bubble bg-secondary bg-opacity-25 p-3'>
              {message}

              <div className='d-flex flex-column align-items-end'>
                {reference && reference.ai_refs.map((docRef, index) => {
                        switch (docRef.reference_type) {
                          case 'File':
                            return (
                              <div key={index} className='font-x-sm mt-2 text-dark-emphasis'>
                                <a 
                                  style={{ color: 'blue', cursor: 'pointer' }} 
                                  onClick={() => openReferencePDF(parseInt(docRef.id), docRef.page + 1)}
                                >
                                  {docRef.filename.split(/[/\\]/).pop()} - Page: {docRef.page + 1}
                                </a>
                                <Tooltip title="View PDF" placement='right'>
                                  <i className="bi bi-box-arrow-in-up-right cursor-pointer font-sm text-primary ms-1" onClick={() => openReferencePDF(parseInt(docRef.id), docRef.page)}></i>
                                </Tooltip>
                              </div>
                            );
                          case 'Gmail':
                            return (
                              <div key={index} className='font-x-sm mt-2 text-dark-emphasis'>
                                <a 
                                  href={docRef.reference_link} 
                                  onClick={(e)=>{e.preventDefault(); openLinkExternally(docRef.reference_link)}} 
                                  target="_blank"
                                  style={{ color: 'blue', cursor: 'pointer' }} 
                                >
                                  {docRef.email_subject}
                                </a>
                                <Tooltip title="View Email" placement='right'>
                                  <i className="bi bi-box-arrow-in-up-right cursor-pointer font-sm text-primary ms-1" 
                                      onClick={(e)=>{e.preventDefault(); openLinkExternally(docRef.reference_link)}}
                                  />
                                </Tooltip>
                              </div>
                            );
                          case 'URL':
                            return (
                              <div key={index} className='font-x-sm mt-2 text-dark-emphasis'>
                                <a 
                                  href={docRef.reference_link} 
                                  onClick={(e)=>{e.preventDefault(); openLinkExternally(docRef.reference_link)}} 
                                  target="_blank" 
                                  style={{ color: 'blue', cursor: 'pointer' }} 
                                >
                                  {docRef.website_title}
                                </a>
                                <Tooltip title="View Website" placement='right'>
                                  <i className="bi bi-box-arrow-in-up-right cursor-pointer font-sm text-primary ms-1" 
                                      onClick={(e)=>{e.preventDefault(); openLinkExternally(docRef.reference_link)}}
                                  />
                                </Tooltip>
                              </div>
                            );
                          default:
                            return null;
                        }
                })}
              </div>
          </div>

          <Tooltip title="Copy" placement='top'>
            <i className={`bi text-secondary ms-2 btn-general2 p-2 rounded-2 bi-${clipboard}`} onClick={handleClipboardClick}/>
          </Tooltip>
          <div className='position-relative'>
              <Tooltip title="Bad response" placement='top'>
                <i className={`bi btn-general2 position-relative p-2 rounded-2 bi-hand-thumbs-down${thumb}`} onClick={handleThumbClick}/>
              </Tooltip>
              <div className='thumb-down-content-wrapper' style={{display: `${thumbDownReason}`}}>
                <div className='d-flex justify-content-between'>
                  <div className='font-sm'>Tell us more:</div>
                  <i className="bi bi-x cursor-pointer" onClick={()=>setThumbDownReason("none")}></i>
                </div>
                <div className='thumb-down-content btn-general2 font-sm mb-2' onClick={()=>handleFeedbackClick('Not-Accurate-Feedback button')}>
                    Not accurate<br/> (made-up truth)
                </div>
                <div className='thumb-down-content btn-general2 font-sm' onClick={()=>handleFeedbackClick('Not-Relevnant-Feedback button')}>
                  Not relevnant <br/> (not what I am asking)</div>
              </div>
          </div>
      </div>
  )
}
