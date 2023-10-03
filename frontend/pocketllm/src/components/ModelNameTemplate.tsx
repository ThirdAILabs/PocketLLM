type modelNameProps = {
    model: String;
    modelType: String;
}

export default function ModelName({model, modelType}: modelNameProps) {
  return (
    <div className='mx-2'>
        <div className='model-name'>{model}</div>
        <div className='model-type'>{modelType}</div>
    </div>
  )
}
