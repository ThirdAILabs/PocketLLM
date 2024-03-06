type progressBarProps = {
    progress: number;
}

export default function ProgressBarWithLabel({progress} : progressBarProps) {
  return (
    <div className='px-3'>
        <div className="progress" role="progressbar" aria-label="Basic example"
        aria-valuenow={0} aria-valuemin={0} aria-valuemax={100}
        style={{height: "12px"}}
        >
            <div className="progress-bar progress-bar-style font-x-sm" style={{width: `${progress}%`}}>{progress}%</div>
        </div>
    </div>
    
  )
}
