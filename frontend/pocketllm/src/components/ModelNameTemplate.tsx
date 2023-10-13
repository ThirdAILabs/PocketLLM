import { ModelDisplayInfo } from '../App'

type ModelNameProps = {
  modelInfo: ModelDisplayInfo | null;
}

export default function ModelName({ modelInfo }: ModelNameProps) {

  if (!modelInfo) return <></>; // render <></> if modelInfo is null

  return (
    <div className='mx-2'>
        <div className='model-name'>{modelInfo.model_name}</div>
        <div className='model-type'>{modelInfo.author_name}</div>
    </div>
  )
}
