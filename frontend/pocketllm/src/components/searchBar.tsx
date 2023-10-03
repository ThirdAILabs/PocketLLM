import { useState, ChangeEvent, FormEvent } from 'react'
import axios from 'axios'
import { SearchResult } from '../App'
import SpecifyModel from './SpecifyModel'
import { usePort } from '../PortContext'

interface SearchBarProps {
  onSearch: (results: SearchResult[]) => void,
  onSummary: (result: string) => void,
}

export default function SearchBar( { onSearch, onSummary }: SearchBarProps ) {
  const { port } = usePort()

  const [searchStr, setSearchStr] = useState('')

  const [model, setModel] = useState("None");

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchStr(e.target.value)
  }

  const handleSubmit = async (e: FormEvent) => {
      e.preventDefault()

      try {
        const response = await axios.post(`http://127.0.0.1:${port}/query`, {
          search_str: searchStr
        })
        
        console.log(response.data)
        onSearch(response.data)
      } catch (error) {
        console.error('Error:', error)
      }

      // Empty summary chat
      onSummary('')

      if (model === 'ThirdAI') {
        
        axios.post(`http://localhost:${port}/summarize`)
        .then(response => onSummary(response.data[0]))
        .catch(error => {
          console.error("Error generating ThirdAI summary", error);
        })

      } else if (model === 'OpenAI') {
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

  return (
    <>
      <div className="input-group input-group-sm mb-3 px-5 d-flex justify-content-center">
            <span className="input-group-text bg-transparent rounded-start-3" id="inputGroup-sizing-sm">
                <i className="bi bi-search text-dark-emphasis"></i>
            </span>
            <form onSubmit={handleSubmit}>
              <input 
                type="text" 
                id='input-search' 
                className="form-control border-start-0 border-end-0 rounded-0" 
                placeholder='Search'
                value={searchStr} 
                onChange={handleInputChange}
              />
            </form>
            <SpecifyModel setModel = {setModel}/>
      </div>

      
    </>
  )
}
