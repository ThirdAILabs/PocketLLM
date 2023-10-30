
import * as React from 'react';
import { v4 as uuidv4 } from 'uuid'
import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import { usePort } from '../PortContext'
import ProgressBar from './ProgressBar';
import { WorkSpaceMetadata } from '../App'
import { ModelDisplayInfo } from '../App'

type LoadUrlProps = {
  curWorkSpaceID: string|null,
  setCurWorkSpaceID: React.Dispatch<React.SetStateAction<string|null>>,
  setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
  currentModel: ModelDisplayInfo | null,
}

export default function LoadUrl({curWorkSpaceID, setWorkSpaceMetadata, setCurWorkSpaceID, currentModel}: LoadUrlProps) {
  const { port } = usePort()

  const [startProgress, setStartProgress] = React.useState(false);
  const [progress, setProgress] = React.useState(0);


  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const [url, setUrl] = React.useState<string>('')
  // const [wsMessage, setWsMessage] = React.useState<string>('')

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(anchorEl ? null : event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value)
  }

  const handleLoadUrl = () => {
    const ws = new WebSocket(`ws://localhost:${port}/url_train`)
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ url }))
      setStartProgress(true);
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setProgress(data.progress);
      console.log(`${data.progress}% - ${data.message}`)

      // Handle the received data (e.g., display progress or error messages)
      if (data.progress === 100) {
        if (curWorkSpaceID === null) {
          // Create a new workspace
          const newWorkSpaceID = uuidv4()   // Generate a new unique workspace ID
          setCurWorkSpaceID(newWorkSpaceID) // Set the current workspace ID

          const selectedFiles = [
            {
              fileName: url,
              filePath: url,
              isSaved: false,
              uuid: uuidv4(),
            }
          ]

          const newWorkSpaceMetadata = {
              workspaceID: newWorkSpaceID,
              workspaceName: url,
              model_info: {
                  author_name: currentModel ? currentModel.author_name : 'thirdai',
                  model_name: currentModel ? currentModel.model_name : 'Default model',
              },
              documents: selectedFiles,
              last_modified: new Date().toISOString(),
              isWorkSpaceSaved: false,
          };

          setWorkSpaceMetadata(prevMetaData => [...prevMetaData, newWorkSpaceMetadata]);
      } else {
          const selectedFiles = [
            {
              fileName: url,
              filePath: url,
              isSaved: false,
              uuid: uuidv4(),
            }
          ]

          // Index new file into existing workspace
          setWorkSpaceMetadata(prevMetaData => prevMetaData.map(workspace => {
              if (workspace.workspaceID === curWorkSpaceID) {
                  // Combine existing documents with newly selected files
                  const updatedDocuments = [...workspace.documents, ...selectedFiles]

                  // Update the isWorkSpaceSaved property of the matching workspace
                  return { ...workspace, 
                          documents: updatedDocuments, 
                          isWorkSpaceSaved: false 
                      };
              } else {
                  // Return other workspaces without modification
                  return workspace;
              }
          }))
      }

        setTimeout(() => {
          setUrl("");
          handleClose();
          setStartProgress(false)
          setProgress(0)
      }, 500);
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error)
      setStartProgress(false)
    }

    ws.onclose = () => {
      console.log('WebSocket connection closed')
      setStartProgress(false)
    }
  }

  const open = Boolean(anchorEl);
  const id = open ? 'simple-popper' : undefined;

  return (
    <>
      <button type="button" className="btn btn-general mx-1 h-100" aria-describedby={id} onClick={handleClick}>
            <i className="bi bi-link-45deg font-lg"></i>
            <div className='font-sm'>Url</div>
      </button>
      <Popover id={id} open={open} anchorEl={anchorEl} onClose={handleClose} 
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
      >
        <Box>
          {
            startProgress ?
            <div className='pt-3 px-2'>
              <ProgressBar progress={progress}/>
            </div>
            :
            <></>
          }
          
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
      </Popover>
    </>
  );
}


