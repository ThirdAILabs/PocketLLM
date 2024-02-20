import { useState, FormEvent } from 'react'
import axios from 'axios'
import { SearchResult, SummarizerType } from '../../App'
import { usePort } from '../../contexts/PortContext'
import useTelemetry from '../../hooks/useTelemetry'

interface SearchBarProps {
  setSearchResults: (results: SearchResult[]) => void,
  setSummaryResult: (result: string) => void,
  summarizer: string | null,
}

export default function SearchBar( { setSearchResults, setSummaryResult, summarizer }: SearchBarProps ) {
  const { port } = usePort()

  const recordEvent = useTelemetry()

  const [searchStr, setSearchStr] = useState('')

  const handleSubmit = async (e: FormEvent) => {
      e.preventDefault()

      recordEvent({
        UserAction: 'Fire query',
        UIComponent: 'search field',
        UI: 'SearchBar',
      })

      try {
        const response = await axios.post(`http://127.0.0.1:${port}/query`, {search_str: searchStr})

        setSearchResults(response.data)
      } catch (error) {
        console.error('Error:', error)
      }

      // Empty previous summary
      setSummaryResult('')

      if (summarizer === SummarizerType.ThirdAI) {
      
        axios.post(`http://localhost:${port}/summarize`)
        .then(response => setSummaryResult(response.data[0]))
        .catch(error => {
          console.error("Error generating ThirdAI summary", error);
        })

      }
      else if (summarizer === SummarizerType.OpenAI) {
        const socket = new WebSocket(`ws://localhost:${port}/summarize/ws/`);

        socket.addEventListener('open', (_) => {
            // console.log('Connection opened', event)
        });

        socket.addEventListener('message', (event) => {
          // console.log(event)
            setSummaryResult(event.data)
        });

        socket.addEventListener('error', (event) => {
            console.error("Error generating OpenAI summary", event)
        });

        socket.addEventListener('close', (_) => {
            // console.log('Connection closed', event)
        });
      }

  }

  return (
    <div className="input-group input-group-sm d-flex justify-content-center">
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
            onChange={(e)=>setSearchStr(e.target.value)}
          />
        </form>
    </div>
  )
}
