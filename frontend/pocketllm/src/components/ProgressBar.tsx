import { Tooltip } from '@mui/material'

type progressBarProps = {
    progress: number;
    color?: string;
    stoppable?: boolean
    handleClickWorkspacePause?: () => void
}

export default function ProgressBar({progress, color = "primary", stoppable = false, handleClickWorkspacePause} : progressBarProps) {

  return (
    <div className='d-flex px-3 align-items-center pt-3' data-bs-backdrop="static">
      {
        stoppable
        ?
        <Tooltip title="Pause" placement='top'>
          <i className="bi bi-stop-circle me-2 fs-5 text-secondary cursor-pointer" onClick={handleClickWorkspacePause}/>
        </Tooltip>
        :
        <></>
      }
      <div  className="progress w-100" role="progressbar" aria-label="Basic example"
            aria-valuenow={0} aria-valuemin={0} aria-valuemax={100}
            style={{height: "5px"}}
      >
          <div className={`progress-bar progress-bar-style bg-${color}`} style={{width: `${progress}%`}}></div>
      </div>
    </div>
    
  )
}
