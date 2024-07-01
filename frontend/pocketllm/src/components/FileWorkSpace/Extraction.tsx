import { useState } from 'react'
import axios from 'axios'
import Tooltip from '@mui/material/Tooltip';

import { SearchResult } from '../../App'
import { usePort } from '../../contexts/PortContext'
import { WorkSpaceMetadata } from '../../App'
import useTelemetry from '../../hooks/useTelemetry'

import YouTubeIcon from '@mui/icons-material/YouTube';

interface ExtractionProps {
  searchResults: SearchResult[],
  curWorkSpaceID: string|null,
  setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
}

export default function Extraction({ searchResults, curWorkSpaceID, setWorkSpaceMetadata }: ExtractionProps) {
  const { port } = usePort()

  const [collectStates, setCollectStates] = useState(new Array(searchResults.length).fill(" text-dark-emphasis"))

  const recordEvent = useTelemetry()

  function handleUpvote(index: number) {
    // Write into telemetry
    recordEvent({
      UserAction: 'Click',
      UIComponent: 'upvote button',
      UI: 'Extraction',
    })

    // Communicate backend
    axios.post(`http://localhost:${port}/upweight`, { result_idx: index })
    .then(response => {

        if (response.data.success) {
          console.log('upweight success')

          // Adjust UI
          const newCollectStates = [...collectStates]
          newCollectStates[index] = "-fill text-warning"
          setCollectStates(newCollectStates)

          setTimeout(() => {
            const newCollectStates = [...collectStates]
            newCollectStates[index] = " text-dark-emphasis"
            setCollectStates(newCollectStates)
          }, 1500)

          // Mark the workspace as unsaved
          setWorkSpaceMetadata(prevMetaData => prevMetaData.map(workspace => workspace.workspaceID === curWorkSpaceID ? { ...workspace, isWorkSpaceSaved: false } : workspace))
          
        } else {
          console.log('upweight fail')
        }
    })
    .catch(error => {
        console.error('Error:', error)
    })
  }

  async function openReferencePDF(index: number) {
    function openPDFInNewWindow(pdfURL: string) {
      window.electron.send('open-pdf-window', pdfURL);
    }
    
    // Write telemetry
    recordEvent({
      UserAction: 'Click',
      UIComponent: 'open-reference-pdf button',
      UI: 'Extraction',
    })

    try {
        let response = await fetch(`http://localhost:${port}/highlighted_pdf?index=${index}`)
        if (!response.ok)
          throw new Error('Network response was not ok')
        
        let blob = await response.blob()
        let url = URL.createObjectURL(blob)
        let pageToOpen = searchResults[index].page_low
        openPDFInNewWindow(`${url}#page=${pageToOpen}`)
    } catch (error) {
        console.error('Failed to fetch PDF:', error)
    }
  }

  return (
    <div>
      {
        searchResults.map((result, index) => {
          // Check if the result text starts with "video_url:"
          const isVideoResult = result.result_text.startsWith('video_url:');
          let videoUrl = '';
          let resultText = result.result_text;

          if (isVideoResult) {
            // Extract the video URL and the text
            const parts = result.result_text.split('text:');
            videoUrl = parts[0].replace('video_url:', '').trim();
            resultText = parts[1].trim();
          }

          return (
            <div key={index} className='extraction font-sm p-4 rounded-3 d-flex align-items-center mb-3'>
              <button className='btn btn-general p-1 px-2' onClick={() => handleUpvote(index)}>
                <i className={`bi fs-2 collect bi-hand-thumbs-up ${collectStates[index]}`}></i>
              </button>
              <div className="short-vertical-line ms-2 me-4"></div>
              <div>
                <div>{resultText}</div>
                <div className='font-x-sm mt-2 text-dark-emphasis'>
                  <>
                    {isVideoResult ? (
                      <>
                        {`Video URL: `}
                        <a 
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'blue', cursor: 'pointer' }} 
                        >
                          {videoUrl}
                          <YouTubeIcon style={{ color: '#FF0000' }} />
                        </a>
                      </>
                    )
                    :
                      <>
                        {`View PDF: `}
                        <a 
                          style={{ color: 'blue', cursor: 'pointer' }} 
                          onClick={() => openReferencePDF(index)}
                        >
                          {result.result_source.split(/[/\\]/).pop()}
                        </a>
                        <Tooltip title="view PDF" placement='right'>
                          <i className="bi bi-box-arrow-in-up-right cursor-pointer font-sm text-primary ms-1" onClick={() => openReferencePDF(index)}></i>
                        </Tooltip>
                      </>
                    }
                  </>

                  {
                    result.page_low && result.page_high ?
                    <>{` Pages: ${result.page_low} - ${result.page_high}`}</>
                      :
                    <></>
                  }
                </div>
              </div>
            </div>
          )
        })
      }
    </div>
  );
}
