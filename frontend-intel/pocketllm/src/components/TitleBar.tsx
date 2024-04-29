import { Tooltip } from '@mui/material'
import axios from 'axios'
import { WorkSpaceMetadata } from '../App'
import { usePort } from '../contexts/PortContext'

type titleBarProps = {
    workSpaceMetadata: WorkSpaceMetadata[],
    saveWorkSpaceTrigger: React.RefObject<HTMLButtonElement>,
}

function openLinkExternally(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    window.electron.openExternalUrl(e.currentTarget.href)
}

export default function TitleBar({ workSpaceMetadata, saveWorkSpaceTrigger,
                                 } : titleBarProps) {

    const { port } = usePort()

    const handelCloseAppWindow = async () => {
        // Check if there is any workspace that is not saved
        const isUnsavedWorkspaceExist = workSpaceMetadata.some(workspace => !workspace.isWorkSpaceSaved);

        if (isUnsavedWorkspaceExist) {
            // If there are unsaved workspaces, trigger the save button
            saveWorkSpaceTrigger.current?.click();
        } else {
            window.electron.send("closeApp")
        }
    }

    const handleExportBackendLog = () => {
        window.electron.invoke('show-save-log-dialog').then(filePath => {
            if (!filePath) {
                console.log('Save log dialog was canceled')
                return
            }

            console.log('Log file will be saved to:', filePath)

            axios.post(`http://localhost:${port}/copy_log_file`, { filePath })
                .then(response => {
                    console.log('Log file saved successfully:', response.data)
                })
                .catch(error => {
                    console.error('Error during log file saving:', error.response ? error.response.data : error.message)
                })
        })
        .catch(err => {
            console.error('Error showing save dialog', err)
        })
    }

    return (
      <div className="title-bar">
          <div className="d-flex justify-content-between align-items-start m-2 w-100">
                  <div className='d-flex align-items-center mt-2 ms-2'>                   
                      
                      <Tooltip title="PocketLLM community" placement='left'>
                        <button className='no-drag btn border-0 bg-transparent mt-1 p-0 me-3'>
                          <a target='_blank' onClick={openLinkExternally} href='https://discord.gg/thirdai'>
                            <i className="bi bi-discord fs-5" style={{color: "#7289da"}}></i>
                          </a>
                        </button>
                      </Tooltip>

                        <Tooltip title="Share a bug" placement='right'>
                            <button className='no-drag btn border-0 bg-transparent mt-1 p-0' onClick={handleExportBackendLog}>
                                <i className="bi bi-tools fs-5" style={{color: "#5cb85c"}}></i>
                            </button>
                        </Tooltip>
                      
                  </div>

              <div className='d-flex justify-content-end align-items-center'>
                  <button className='btn btn-general title-functions'
                      onClick={()=>window.electron.send("minimizeApp")}>
                      <i className="bi bi-dash fs-5"></i>
                  </button>
                  <button className='btn btn-general title-functions mx-1'
                      onClick={()=>window.electron.send("fullscreen")}>
                      <i className="bi bi-app" style={{fontSize: "11px"}}></i>
                  </button>
                  <button className='btn btn-general title-functions'
                      onClick={()=>handelCloseAppWindow()}>
                      <i className="bi bi-x fs-5"></i>
                  </button>
                  
              </div>
          </div>
          
      </div>
  )
}
