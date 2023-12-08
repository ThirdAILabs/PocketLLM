import { useState, ChangeEvent, FormEvent } from 'react'
import axios from 'axios'
import { SearchResult } from '../pages/MainPage'
import { usePort } from '../PortContext'
import useTelemetry from '../hooks/useTelemetry'

interface SearchBarProps {
  onSearch: (results: SearchResult[]) => void,
  onSummary: (result: string) => void,
  summarizer: string | null,
  queryEnabled: Boolean,
}

export default function SearchBar( { onSearch, onSummary, summarizer, queryEnabled }: SearchBarProps ) {
  const { port } = usePort()

  const [searchStr, setSearchStr] = useState('')

  // For telemetry
  const recordEvent = useTelemetry()

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchStr(e.target.value)
  }

  const handleSubmit = async (e: FormEvent) => {
      e.preventDefault()

      let searchResult

      try {
        const response = await axios.post(`http://127.0.0.1:${port}/query`, {
          search_str: searchStr
        })

        recordEvent({
          UserAction: 'Fire query',
          UIComponent: 'search field',
          UI: 'SearchBar',
        })
        
        console.log(response.data)
        searchResult = response.data
        onSearch(response.data)
      } catch (error) {
        console.error('Error:', error)
      }

      // Empty summary chat
      onSummary('')

      // Currently, if Source is gmail, summarization is disabled.
      // Reason: gmails are very long, by default we use 4960 context GPT-3.5-turbo for query summarization.
      const existsGmailResult = searchResult.some((item: SearchResult) => item.result_type === 'Gmail')

      if (! existsGmailResult) {
        if (summarizer === 'ThirdAI') {
        
          axios.post(`http://localhost:${port}/summarize`)
          .then(response => onSummary(response.data[0]))
          .catch(error => {
            console.error("Error generating ThirdAI summary", error);
          })
  
        } else if (summarizer === 'OpenAI') {
          const socket = new WebSocket(`ws://localhost:${port}/summarize/ws/`);
  
          socket.addEventListener('open', (event) => {
              // The connection is established. You can optionally send a greeting or keep listening for messages.
              console.log('Connection opened', event);
          });
  
          socket.addEventListener('message', (event) => {
              // This is where you get chunks from the server
              onSummary(event.data);
          });
  
          socket.addEventListener('error', (event) => {
              console.error("Error generating OpenAI summary", event);
          });
  
          socket.addEventListener('close', (event) => {
              console.log('Connection closed', event);
          });
        }
      }
  }

  return (
    <>
    {
      queryEnabled ?
      <div className="input-group input-group-sm mb-3 px-5 d-flex justify-content-center">
            <span className="input-group-text bg-transparent rounded-start-3" id="inputGroup-sizing-sm">
                <i className="bi bi-search text-dark-emphasis"></i>
            </span>
            <form onSubmit={handleSubmit}>
              <input 
                type="text" 
                id='input-search' 
                className="form-control border border-start-0 rounded-0 rounded-end-3 border-light-subtle" 
                placeholder='Search'
                value={searchStr} 
                onChange={handleInputChange}
              />
            </form>
      </div>
      :
      <></>
    }

    </>
  )
}
