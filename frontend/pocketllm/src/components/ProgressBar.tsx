type progressBarProps = {
    progress: number;
}

export default function ProgressBar({progress} : progressBarProps) {
  return (
    <div className='px-3'>
        <div className="progress" role="progressbar" aria-label="Basic example"
        aria-valuenow={0} aria-valuemin={0} aria-valuemax={100}
        style={{height: "5px"}}
        >
            <div className="progress-bar progress-bar-style" style={{width: `${progress}%`}}></div>
        </div>
    </div>
    
  )
}
