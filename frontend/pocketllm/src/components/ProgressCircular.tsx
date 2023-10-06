import CircularProgress from '@mui/material/CircularProgress';

type progressCircularProps = {
    progress: number;
}

export default function ProgressCircular({progress} : progressCircularProps) {
  return (
      <CircularProgress variant="determinate" value={progress} size={30} />
  );
}