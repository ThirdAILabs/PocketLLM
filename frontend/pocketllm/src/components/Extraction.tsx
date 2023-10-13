import { useState } from 'react'
import { SearchResult } from '../App'
import axios from 'axios'
import { usePort } from '../PortContext'

interface ExtractionProps {
  searchResults: SearchResult[]
}

export default function Extraction({ searchResults }: ExtractionProps) {
  const { port } = usePort()

  const [collectStates, setCollectStates] = useState(
    new Array(searchResults.length).fill(" text-dark-emphasis")
  )

  function handleCollect(index: number) {
    const newCollectStates = [...collectStates]
    newCollectStates[index] = "-fill text-warning"
    setCollectStates(newCollectStates)

    axios.post(`http://127.0.0.1:${port}/upweight`, { result_idx: index })
    .then(response => {

        if (response.data.success) {
          console.log('upweight success')
        } else {
          console.log('upweight fail')
        }
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
  }

  return (
    <div>
      {searchResults.map((result, index) => (
        <div key={index} className='extraction font-sm p-4 rounded-3 d-flex align-items-center mb-3'>
          <button className='btn btn-general p-1 px-2' onClick={() => handleCollect(index)}>
            <i className={`bi fs-2 collect bi-bookmark-star ${collectStates[index]}`}></i>
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
                          >
                                {result.result_source}
                          </a>
                          :
                          result.result_source
                      }
              
              {
                result.page_low && result.page_high ?
                (` Pages: ${result.page_low} - ${result.page_high}`) :
                <></>
              }
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
