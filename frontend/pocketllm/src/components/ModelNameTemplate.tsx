import { ModelDisplayInfo } from '../App'

type ModelNameProps = {
  modelInfo: ModelDisplayInfo | null;
}

export default function ModelName({ modelInfo }: ModelNameProps) {

  if (!modelInfo) return (
    <div className='mx-2'>
        <div className='model-name'>Quick workspace</div>
    </div>
  )

  return (
    <div className='mx-2'>
        <div className='model-name'>{modelInfo.model_name === 'Default model' ? 'Quick workspace' : 'Expert workspace'}</div>
    </div>
  )
}
