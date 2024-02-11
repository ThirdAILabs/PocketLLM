import { useEffect, useState } from 'react'
import { SearchResult } from '../pages/MainPage'
import axios from 'axios'
import { usePort } from '../PortContext'
import Tooltip from '@mui/material/Tooltip';
import { WorkSpaceMetadata } from '../App'

import Clearification from './Clearification'
import useTelemetry from '../hooks/useTelemetry'

interface ExtractionProps {
  searchResults: SearchResult[],
  openAISetKeyNotice: () => void,
  curWorkSpaceID: string|null,
  setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
}

export default function Extraction({ searchResults, openAISetKeyNotice, curWorkSpaceID, setWorkSpaceMetadata }: ExtractionProps) {
  const { port } = usePort()

  const [readNotification, setRead] = useState<boolean>(false)
  const [summaries, setSummaries] = useState<(string | null)[]>([])
  const [replies, setReplies] = useState<(string | null)[]>([])
  const [startReplies, setStartReplies] = useState<boolean[]>([])
  const [textAreaValues, setTextAreaValues] = useState<string[]>([])

  // For telemetry
  const recordEvent = useTelemetry()

  useEffect(() => {
    setSummaries(new Array(searchResults.length).fill(null))
    setReplies(new Array(searchResults.length).fill(null))
    setStartReplies(new Array(searchResults.length).fill(false))
    setTextAreaValues(new Array(searchResults.length).fill(''))
  }, [searchResults])

  const handleSummarizeClick = (index: number) => {
    const onSummary = (data: string, index: number) => {
      setSummaries(prev => {
        const newSummaries = [...prev]
        newSummaries[index] = data
        return newSummaries
      })
    }

    setSummaries(prev => {
      const newSummaries = [...prev]
      newSummaries[index] = null
      return newSummaries
    })

    const socket = new WebSocket(`ws://localhost:${port}/gmail_summarize/ws/`)

    socket.addEventListener('open', (_) => {
        const emailContent = searchResults[index].result_text
        socket.send(emailContent)
    })

    socket.addEventListener('message', (event) => {
      if (event.data.startsWith("Error")) {
          // notify user to fill in their OpenAIKey
          openAISetKeyNotice()
      } else {
          onSummary(event.data, index);
      }
    })

    socket.addEventListener('error', (event) => {
        console.error("handleSummarizeClick: Error generating OpenAI summary", event)
    })

    socket.addEventListener('close', (_) => {
        console.log('Connection closed')
    })
  }

  const handleCraftReplyClick = (index: number) => {
    const onReply = (data: string, index: number) => {
      setReplies(prev => {
        const newReplies = [...prev]
        newReplies[index] = data
        return newReplies
      })
    }

    setReplies(prev => {
      const newReplies = [...prev]
      newReplies[index] = null
      return newReplies
    });

    const socket = new WebSocket(`ws://localhost:${port}/gmail_reply/ws/`)

    socket.addEventListener('open', (_) => {
        const userIntent = textAreaValues[index]
        const emailContent = searchResults[index].result_text

        socket.send(JSON.stringify({
          emailContent: emailContent,
          userIntent: userIntent
        }))
    })

    socket.addEventListener('message', (event) => {
      if (event.data.startsWith("Error")) {
          // notify user to fill in their OpenAIKey
          openAISetKeyNotice()
      } else {
          onReply(event.data, index);
      }
    })

    socket.addEventListener('error', (event) => {
        console.error("handleCraftReplyClick: Error generating OpenAI summary", event)
    })

    socket.addEventListener('close', (_) => {
        console.log('Connection closed')
    })
  }

  const [collectStates, setCollectStates] = useState(
    new Array(searchResults.length).fill(" text-dark-emphasis")
  )

  function handleCollect(index: number) {
    const newCollectStates = [...collectStates]
    newCollectStates[index] = "-fill text-warning"
    setCollectStates(newCollectStates)

    axios.post(`http://localhost:${port}/upweight`, { result_idx: index })
    .then(response => {

        if (response.data.success) {
          console.log('upweight success')

          // Mark the workspace as unsaved
          setWorkSpaceMetadata(prevMetaData => prevMetaData.map(workspace => 
            workspace.workspaceID === curWorkSpaceID 
              ? { ...workspace, isWorkSpaceSaved: false } 
              : workspace
          ))
          
        } else {
          console.log('upweight fail')
        }

        recordEvent({
          UserAction: 'Click',
          UIComponent: 'upvote button',
          UI: 'Extraction',
        })
    })
    .catch(error => {
        console.error('Error:', error)
    });

    setTimeout(() => {
      const newCollectStates = [...collectStates]
      newCollectStates[index] = " text-dark-emphasis"
      setCollectStates(newCollectStates)
    }, 1500)
  }


  function openLinkExternally(e: React.MouseEvent<HTMLAnchorElement>) {
      e.preventDefault();
      window.electron.openExternalUrl(e.currentTarget.href);

      recordEvent({
        UserAction: 'Click',
        UIComponent: 'open-reference-link button',
        UI: 'Extraction',
      })
  }

  async function fetchPDF(index: number) {
    function openPDFInNewWindow(pdfURL: string) {
      window.electron.send('open-pdf-window', pdfURL);
    }

    try {
      let response = await fetch(`http://localhost:${port}/highlighted_pdf?index=${index}`)
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      let blob = await response.blob();
      let url = URL.createObjectURL(blob);
      let pageToOpen = searchResults[index].page_low
      openPDFInNewWindow(`${url}#page=${pageToOpen}`);
    } catch (error) {
      console.error('Failed to fetch PDF:', error);
    }

    recordEvent({
      UserAction: 'Click',
      UIComponent: 'open-reference-pdf button',
      UI: 'Extraction',
    })
  }

  return (
    
    <div>
      {
          searchResults.map((result, index) => (
                result.result_type === 'Gmail' || result.result_type === 'Outlook'
                ?
                <div key={index} className='extraction font-sm p-4 rounded-3 mb-3 w-100'>
                    <div className='d-flex align-items-center'>
                      <div>
                          <button className='btn btn-general p-1 px-2'>
                            <i className="bi fs-2 collect bi-hand-thumbs-up"></i>
                          </button>
                      </div>

                      <div className="short-vertical-line ms-2 me-4"></div>
                      <div style={{width: "calc(100% - 80px)"}}>
                          <span style={{overflowWrap: "break-word"}}>{result.result_text}</span>
                          <div className='font-x-sm mt-2 text-dark-emphasis'>
                            View email: {result.result_source.startsWith('http') ? 
                                              <a 
                                                href={result.result_source} 
                                                onClick={openLinkExternally} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                              >
                                                    {result.result_source}
                                              </a>
                                              :
                                              result.result_source
                                          }
                          </div>
                      </div>
                    </div>
                    <div className='d-flex justify-content-end mt-2'>
                      {
                        readNotification ?
                        <>
                          <button onClick={() => {handleSummarizeClick(index); 
                                                  recordEvent({
                                                    UserAction: 'Click',
                                                    UIComponent: 'gmail-summarization button',
                                                    UI: 'Extraction',
                                                  })}}
                                  className='btn font-sm btn-general border border-dark-subtle mx-1'>Summarize</button>
                          <button onClick={() => {setStartReplies(prevStartReplies => prevStartReplies.map((value, idx) => idx === index ? true : value));
                                                  recordEvent({
                                                    UserAction: 'Click',
                                                    UIComponent: 'gmail-craft-reply button',
                                                    UI: 'Extraction',
                                                  })}}
                                  className='btn font-sm btn-general border border-dark-subtle'>Craft Reply</button>
                        </>
                        :
                        <>
                          <Clearification setRead = {setRead} clarifyItem = {'Summarize'}/>
                          <Clearification setRead = {setRead} clarifyItem = {'Craft Reply'}/>
                        </>
                      }
                    </div>
                    <div>
                        {summaries[index] && (
                          <>
                            <div className='horizontal-line my-3'/>
                            <div className='mb-2'> <i className="bi bi-journal-text fs-5"></i> Summary </div>
                            <div className='w-100 ps-5' style={{overflowWrap: "break-word"}}>{summaries[index]}</div>
                          </>
                        )}
                        {
                          startReplies[index] && (
                            <>
                              <div className='horizontal-line my-3'/>
                              <div className='mb-2'> <i className="bi bi-reply-all fs-4"></i> Craft Reply </div>
                              <form>
                                <div className="input-group">
                                  <div className='ps-5 me-2 mt-2'>Reply Gist</div>
                                  <textarea
                                            value={textAreaValues[index] || ''}
                                            onChange={(e) => {
                                                const newValue = e.target.value
                                                setTextAreaValues(prev => {
                                                    const newValues = [...prev]
                                                    newValues[index] = newValue
                                                    return newValues
                                                })
                                            }}
                                            className="form-control rounded-3 font-sm p-2" 
                                            aria-label="With textarea" 
                                            placeholder='e.g. Briefly state what you would like to rely.'>
                                  </textarea>
                                </div>
                                <div className='d-flex justify-content-end mt-2 mb-3'>
                                  <button onClick={() => {handleCraftReplyClick(index); 
                                                          recordEvent({
                                                            UserAction: 'Click',
                                                            UIComponent: 'craft-reply button',
                                                            UI: 'Extraction',
                                                          })}}
                                          type='button'
                                          className='btn font-sm btn-general border border-dark-subtle'>Start crafting</button>
                                </div>
                              </form>
                              <div className='w-100 ps-5' style={{overflowWrap: "break-word"}}>{replies[index] ? replies[index] : ''}</div>
                            </>
                          )
                        }
                    </div>
                </div>
                :
                <div key={index} className='extraction font-sm p-4 rounded-3 d-flex align-items-center mb-3'>
                  <button className='btn btn-general p-1 px-2' onClick={() => handleCollect(index)}>
                    {/* <i className={`bi fs-2 collect bi-bookmark-star ${collectStates[index]}`}></i> */}
                    <i className={`bi fs-2 collect bi-hand-thumbs-up ${collectStates[index]}`}></i>
                  </button>
                  <div className="short-vertical-line ms-2 me-4"></div>
                  <div>
                    <div>{result.result_text}</div>
                    <div className='font-x-sm mt-2 text-dark-emphasis'>
                      Source: {result.result_source.startsWith('http') ? 
                                  <a 
                                    href={result.result_source} 
                                    onClick={openLinkExternally} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className='text-dark-emphasis'
                                  >
                                        {result.result_source}
                                        <Tooltip title="view url" placement='right'>
                                          <i className="bi bi-box-arrow-in-up-right cursor-pointer font-sm text-primary ms-1"></i>
                                        </Tooltip>
                                  </a>
                                  :
                                  (
                                    <>
                                      {result.result_source.split(/[/\\]/).pop()}
                                      <Tooltip title="view source" placement='right'>
                                        <i className="bi bi-box-arrow-in-up-right cursor-pointer font-sm text-primary ms-1" onClick={()=>fetchPDF(index)}></i>
                                      </Tooltip>
                                    </>
                                  )
                              }
                      
                      {
                        result.page_low && result.page_high ?
                        <>{` Pages: ${result.page_low} - ${result.page_high}`}</>
                         :
                        <></>
                      }
                    </div>
                  </div>
                </div>
          ))
      }
    </div>
  )
}
