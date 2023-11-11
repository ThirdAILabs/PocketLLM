import Tooltip from '@mui/material/Tooltip';
import { WorkSpaceFile } from '../App'
import { WorkSpaceMetadata } from '../App'

type selectedFileProps = {
    queryEnabled: Boolean,
    indexFiles: WorkSpaceFile[],
    workSpaceMetadata: WorkSpaceMetadata[],
    curWorkSpaceID: string | null,
    saveWorkSpaceTrigger: React.RefObject<HTMLButtonElement>,
    setAfterSaveResetCurWorkspace: React.Dispatch<React.SetStateAction<boolean>>, setAllowUnsave: React.Dispatch<React.SetStateAction<boolean>>
}

export default function SelectedFileList({indexFiles, queryEnabled, workSpaceMetadata, curWorkSpaceID, saveWorkSpaceTrigger,
                                            setAfterSaveResetCurWorkspace, setAllowUnsave}: selectedFileProps) {

    const isCurrentWorkspaceExistAndNotSaved = () => {
        const currentWorkspace = workSpaceMetadata.find(workspace => workspace.workspaceID === curWorkSpaceID);
        return currentWorkspace && ! currentWorkspace.isWorkSpaceSaved
    }

    const handleSaveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault()

        console.log("User clicked save workspace button")

        const currentWorkspace = workSpaceMetadata.find(workspace => workspace.workspaceID === curWorkSpaceID);
        if (currentWorkspace && ! currentWorkspace.isWorkSpaceSaved) {
          // If current workspace exists and unsaved
          console.log("Trying to save current unsaved workspace")
          
          // Because user probably wants to stay inside current workpsace, both afterSaveResetCurWorkspace and afterUnSaveResetBackFrontend should be false
          setAfterSaveResetCurWorkspace(false)
          setAllowUnsave(false)
          saveWorkSpaceTrigger.current?.click()
        }
    }

  return (
    <>
    {
        !queryEnabled
        ?
            <div className='font-sm my-2'>Upload source to start search.</div>
        :
            <div className='d-flex justify-content-center align-items-center'>
                <div className='font-sm selected-file-list-wrapper w-100'>
                    <div className='font-x-sm mb-2'>Indexed Files</div>
                    <div className='selected-file-list-scrollbar-wrapper'>
                        {indexFiles.map(( {fileName, isSaved}, key) => (
                            
                            isSaved ?
                            <div key={key}>
                                {fileName}
                            </div>
                            :
                            <div key={key} className='d-flex'>
                                <div>{fileName}</div>
                                <Tooltip title="Indexed file unsaved" placement='right'>
                                    <div className='ms-1' style={{cursor: "default"}}>*</div>
                                </Tooltip>
                            </div>
                            
                        ))}

                    </div>

                    
                </div>
                {
                        isCurrentWorkspaceExistAndNotSaved()
                        ?
                        <Tooltip title="Save (ctrl/cmd + S)" placement='right'>
                            <button className='btn btn-general no-drag text-secondary ms-3'
                                    onClick={handleSaveClick}
                            >
                                <i className="bi bi-floppy"></i>
                            </button>
                        </Tooltip>
                        :
                        <></>               
                }
            </div>
            
    }
    </>
  )
}
