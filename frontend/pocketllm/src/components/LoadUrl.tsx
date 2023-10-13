
import * as React from 'react';
import Box from '@mui/material/Box';
import Popper from '@mui/material/Popper';
import { usePort } from '../PortContext'

export default function LoadUrl() {
  const { port } = usePort()

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const [url, setUrl] = React.useState<string>('')
  const [wsMessage, setWsMessage] = React.useState<string>('')

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(anchorEl ? null : event.currentTarget)
  }

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value)
  }

  const handleLoadUrl = () => {
    const ws = new WebSocket(`ws://localhost:${port}/url_train`)
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ url }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      console.log(`${data.progress}% - ${data.message}`)

      // Handle the received data (e.g., display progress or error messages)
    }

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error)
    }

    ws.onclose = () => {
      console.log('WebSocket connection closed')
    }
  }

  const open = Boolean(anchorEl);
  const id = open ? 'simple-popper' : undefined;

  return (
    <div>
      <button type="button" className="btn btn-general mx-1" aria-describedby={id} onClick={handleClick}>
            <i className="bi bi-link-45deg font-lg"></i>
            <div className='font-sm'>Url</div>
      </button>
      <Popper id={id} open={open} anchorEl={anchorEl}>
        <Box sx={{ border: 1, borderColor: "rgb(198, 198, 198)", borderRadius: "8px", fontSize: "small", p: 1, m: 1, backgroundColor: "#fff", boxShadow: "1px 2px 3px 1px rgba(225, 225, 225)" }}>
            <div className='d-flex p-3'>
                <input 
                  className='form-control font-sm' 
                  placeholder='https://' 
                  style={{maxHeight: "30px"}}
                  value={url}
                  onChange={handleUrlChange}
                />
                <button 
                  className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1' 
                  style={{maxHeight: "30px", minWidth: "100px"}}
                  onClick={handleLoadUrl}
                  >
                    Load Url
                </button>
            </div>
          
        </Box>
      </Popper>
    </div>
  );
}


