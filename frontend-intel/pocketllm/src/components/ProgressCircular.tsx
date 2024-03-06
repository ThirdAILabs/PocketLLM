import CircularProgress from '@mui/material/CircularProgress';

type progressCircularProps = {
    progress: number;
}

export default function ProgressCircular({progress} : progressCircularProps) {
  return (
    <div className='position-relative'>
      <CircularProgress variant="determinate" value={100} size={30} 
        sx={{
          color: (theme) =>
            theme.palette.grey[theme.palette.mode === 'light' ? 400 : 800],
        }}/>
       <CircularProgress variant="determinate" value={progress} size={30} 
        sx={{
          position: "absolute",
          left: 0
        }}
       />
       
    </div>
     
  );
}