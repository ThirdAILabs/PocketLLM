import { ModelDisplayInfo } from '../App'

type ModelNameProps = {
  modelInfo: ModelDisplayInfo | null;
}

export default function ModelName({ modelInfo }: ModelNameProps) {

  if (!modelInfo) return (
    <div className='mx-2'>
        <div className='model-name'>Default model</div>
        <i className='model-type'>thirdai</i>
    </div>
  )

  return (
    <div className='mx-2'>
        <div className='model-name'>{modelInfo.model_name}</div>
        <i className='model-type'>{modelInfo.author_name}</i>
    </div>
  )
}
