import { useEffect, useState } from 'react'
import ModelCardMini from '../components/ModelCardMini';
import axios from 'axios'
import { Link } from 'react-router-dom';
import { usePort } from '../PortContext'
import { ModelDisplayInfo } from '../App'

export interface Model {
    access_level: string;
    author_email: string;
    author_username: string;
    description: string;
    domain: string;
    hash: string;
    identifier: string;
    is_indexed: boolean;
    model_name: string;
    num_params: number;
    publish_date: string;
    size: number;
    size_in_memory: number;
    thirdai_version: string;
    trained_on: string;
  }

interface ModelCardsProps {
  setCurrentModel: React.Dispatch<React.SetStateAction<ModelDisplayInfo | null>>;
  setCurWorkSpaceID: (modelID: string | null) => void,
  progress: number,
  setProgress: React.Dispatch<React.SetStateAction<number>>,
  startProgress: boolean, 
  setStartProgress: React.Dispatch<React.SetStateAction<boolean>>,
}

export default function ModelCards({ setCurrentModel, setCurWorkSpaceID,
                                      progress, setProgress,
                                      startProgress, setStartProgress }: ModelCardsProps) {
    const { port } = usePort()
    const [cachedModels, setCachedModels] = useState<Model[]>([])

    useEffect(() => {
        // Check the currently downloaded model
        axios.post(`http://localhost:${port}/fetch_meta_cache_model`)
        .then(response => {
          // Set the fetched model cards to state
          console.log(`these models are already downloaded: ${response.data}`)
          setCachedModels(response.data)
        })
        .catch(error => {
          console.error("Error fetching model cards", error);
        });
      }, [])

    return (
      <div className='w-100 model-cards-wrapper d-flex flex-column justify-content-between'>
        <div className='w-100 h-100 d-flex flex-column justify-content-center align-items-center'>
          <h2 className='fw-bold mb-5'>New Workspace</h2>
          <div className='d-flex'>
            <ModelCardMini 
                  name="Basic workspace" 
                  modelName="Default model"
                  author="thirdai"
                  description="Lightweight, fast for simple use cases."
                  status={0}
                  publishDate="2023-07-31" 
                  trainSet="Highly curated text"
                  diskSize={`0 GB`} 
                  ramSize={`0 GB`}
                  cached={true}
                  setCachedModels = {setCachedModels}
                  uninstallable = {false}
                  setCurrentModel={setCurrentModel}
                  setCurWorkSpaceID = {setCurWorkSpaceID}
                  progress = {progress} setProgress = {setProgress}
                  startProgress = {startProgress} setStartProgress = {setStartProgress}
              />

            
            <ModelCardMini 
                name="Expert workspace" 
                modelName='GeneralQnA'
                author="thirdai"
                description="Improved retrieval accuracy & customizability. Require one time download."
                status={0}
                publishDate="2023-07-31" 
                trainSet="Highly curated text"
                diskSize={`0 GB`} 
                ramSize={`0 GB`}
                cached={cachedModels.some(cachedModel => cachedModel.identifier === `thirdai/GeneralQnA`)}
                setCachedModels = {setCachedModels}
                uninstallable = {true}
                setCurrentModel={setCurrentModel}
                setCurWorkSpaceID = {setCurWorkSpaceID}
                progress = {progress} setProgress = {setProgress}
                startProgress = {startProgress} setStartProgress = {setStartProgress}
            />
          </div>
            
        </div>
        <Link to="/" className='d-flex w-100 align-items-start justify-content-end p-4'> 
            <button className="btn border bg-white border-light-subtle border-shadow text-secondary font-sm ms-2 btn-general2">
              Cancel
            </button>
          </Link>
      </div>
    )
}
