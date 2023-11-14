import { ModelDisplayInfo } from '../App'

type ModelNameProps = {
  modelInfo: ModelDisplayInfo | null;
}

export default function ModelName({ modelInfo }: ModelNameProps) {

  if (!modelInfo) return (
    <div className='mx-2'>
        <div className='model-name'>Basic workspace</div>
    </div>
  )

  return (
    <div className='mx-2'>
        <div className='model-name'>{modelInfo.model_name === 'Default model' ? 'Basic workspace' : 'Expert workspace'}</div>
    </div>
  )
}
