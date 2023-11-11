import axios from 'axios'
import { usePort } from '../PortContext'
import { Model } from '../pages/ModelCards'

export type ModelCardFunctionsProps = {
    modelName: string,
    author: string,
    setIsDownloaded: React.Dispatch<React.SetStateAction<boolean>>,
    setCachedModels: React.Dispatch<React.SetStateAction<Model[]>>,
}

export default function ModelCardFunctions({ author, modelName, setIsDownloaded, setCachedModels }: ModelCardFunctionsProps) {
    const { port } = usePort()

    const uninstallModel = async () => {
        try {
          const response = await axios.post(`http://localhost:${port}/remove_model`, {
            author_username: author,
            model_name: modelName,
          })
    
          console.log(response.data.msg)
          setIsDownloaded(false)
          setCachedModels(prevModels =>
            prevModels.filter(model => 
              model.model_name !== modelName || model.author_username !== author
            )
          )
    
        } catch (error) {
          console.error('Error uninstalling model:', error)
        }
      }

  return (
    <div >

        <button className='btn btn-general' type="button" data-bs-toggle="dropdown" aria-expanded="false">
            <i className="bi bi-three-dots"></i>
        </button>


        <ul className="dropdown-menu font-sm mt-1 border-light-subtle border-shadow">
            <li>
                <button className="dropdown-item d-flex btn-general2"
                        onClick={uninstallModel}
                >
                    <div className='me-2'>Uninstall workspace</div>
                </button>
            </li>
        </ul>
    </div>
  )
}
