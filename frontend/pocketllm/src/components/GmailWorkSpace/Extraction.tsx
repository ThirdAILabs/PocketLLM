import { useState } from 'react'
import axios from 'axios'
import Tooltip from '@mui/material/Tooltip';

import { SearchResult } from '../../App'
import { usePort } from '../../contexts/PortContext'
import { WorkSpaceMetadata } from '../../App'
import useTelemetry from '../../hooks/useTelemetry'

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

  function openLinkExternally(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    window.electron.openExternalUrl(e.currentTarget.href);

    recordEvent({
      UserAction: 'Click',
      UIComponent: 'open-reference-link button',
      UI: 'Extraction',
    })
  }

  return (
    <div>
      {
          searchResults.map((result, index) => (
                <div key={index} className='extraction font-sm p-4 rounded-3 d-flex align-items-center mb-3'>
                  <button className='btn btn-general p-1 px-2' onClick={() => handleUpvote(index)}>
                    <i className={`bi fs-2 collect bi-hand-thumbs-up ${collectStates[index]}`}></i>
                  </button>
                  <div className="short-vertical-line ms-2 me-4"></div>
                  <div>
                      <div>{result.result_text}</div>
                      <div className='font-x-sm mt-2 text-dark-emphasis'>
                        <>
                            {`View Gmail: `}
                            <a 
                              href={result.result_source} 
                              onClick={openLinkExternally} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                                  {result.result_source}
                                  <Tooltip title="view website" placement='right'>
                                    <i className="bi bi-box-arrow-in-up-right cursor-pointer font-sm text-primary ms-1"></i>
                                  </Tooltip>
                            </a>
                        </>
                      </div>
                  </div>
                </div>
          ))
      }
    </div>
  )
}
