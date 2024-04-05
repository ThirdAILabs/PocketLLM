import Tooltip from '@mui/material/Tooltip'
import { AIReference } from '../pages/ChatPage'
import { usePort } from '../contexts/PortContext'

interface ChatBotProps {
  message: string
  reference?: AIReference
}

export default function ChatBot({message, reference}: ChatBotProps) {
  const { port } = usePort()

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

  return (
      isLoading
      ?
      loadingElem()
      :
      <div className='d-flex mb-3'>
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
      </div>
  )
}
