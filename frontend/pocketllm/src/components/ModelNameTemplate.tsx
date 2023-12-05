import Tooltip from '@mui/material/Tooltip';
import { ModelDisplayInfo, WorkSpaceMetadata } from '../App'

type ModelNameProps = {
  modelInfo: ModelDisplayInfo | null;
  curWorkSpaceID: string | null,
  workSpaceMetadata: WorkSpaceMetadata[],
}

export default function ModelName({ modelInfo, curWorkSpaceID, workSpaceMetadata }: ModelNameProps) {

  const isCurrentWorkspaceExistAndNotSaved = () => {
    const currentWorkspace = workSpaceMetadata.find(workspace => workspace.workspaceID === curWorkSpaceID);
    return currentWorkspace && ! currentWorkspace.isWorkSpaceSaved
  }

  if (!modelInfo) return (
    <div className='mx-2'>
        <div className='model-name'>
          Basic workspace 
          {`${isCurrentWorkspaceExistAndNotSaved() ? '*' : ''}`}
        </div>
    </div>
  )

  return (
    <div className='mx-2'>
      {
        isCurrentWorkspaceExistAndNotSaved()
        ?
        <Tooltip title="Tip: Ctrl/Cmd + S" placement='right'>
          <div className='model-name'>
            {modelInfo.model_name === 'Default model' ? 'Basic workspace' : 'Expert workspace'}
            {`${isCurrentWorkspaceExistAndNotSaved() ? ' *' : ''}`}
          </div>
        </Tooltip>
        :
        <div className='model-name'>
            {modelInfo.model_name === 'Default model' ? 'Basic workspace' : 'Expert workspace'}
        </div>
      }
    </div>
  )
}
