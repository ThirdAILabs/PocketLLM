import Tooltip from '@mui/material/Tooltip';
import { WorkSpaceFile } from '../App'

type selectedFileProps = {
    queryEnabled: Boolean,
    indexFiles: WorkSpaceFile[],
}

export default function SelectedFileList({indexFiles, queryEnabled}: selectedFileProps) {

  return (
    <>
    {
        !queryEnabled
        ?
            <div className='font-sm my-2'>Upload to start</div>
        :
            <div className='d-flex justify-content-center align-items-center'>
                <div className='font-sm selected-file-list-wrapper w-100'>
                    <div className='font-x-sm mb-2'>Contexts</div>
                    <div className='selected-file-list-scrollbar-wrapper'>
                        {indexFiles.map(( {fileName, isSaved}, key) => (
                            
                            isSaved ?
                            <div key={key}>
                                {fileName}
                            </div>
                            :
                            <div key={key} className='d-flex'>
                                <div>{fileName}</div>
                                <Tooltip title="Unsaved" placement='right'>
                                    <div className='ms-1' style={{cursor: "default"}}>*</div>
                                </Tooltip>
                            </div>
                            
                        ))}

                    </div>

                    
                </div>
            </div>
            
    }
    </>
  )
}
