import { useEffect, useState } from 'react'
import ModelCard from "./ModelCard"
import axios from 'axios'
import { Link } from 'react-router-dom';
import ModelChip from './ModelChip';
import { usePort } from '../PortContext'
import { ModelDisplayInfo } from '../App'

// Define a type for ModelCard data
interface ModelCardData {
    domain: string,
    modelName: string,
    authorUsername: string,
    modelDesc: string,
    task: string,
    hasIndex: boolean,
    publishDate: string,
    dataset: string,
    modelSize: number,
    modelSizeInMemory: number,
    isCached: boolean,
}

interface Model {
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
}

export default function ModelCards({ setCurrentModel }: ModelCardsProps) {
    const { port } = usePort()
    const [selectedChip, setSelectedChip] = useState<number | null>(null)
    const [modelCards, setModelCards] = useState<ModelCardData[]>([])
    const [cachedModels, setCachedModels] = useState<Model[]>([])

    // Used to filter model cards based on dataset
    const [selectedTask, setSelectedTask] = useState<string | null>(null)

    useEffect(() => {
        // Check the currently downloaded model
        axios.post(`http://localhost:${port}/fetch_meta_cache_model`)
        .then(response => {
          // Set the fetched model cards to state
          console.log(response.data)
          setCachedModels(response.data)
        })
        .catch(error => {
          console.error("Error fetching model cards", error);
        });

        // Make an axios request to fetch the model metadata
        axios.post(`http://localhost:${port}/fetch_model_cards`)
          .then(response => {
            // Set the fetched model cards to state
            setModelCards(response.data);
          })
          .catch(error => {
            console.error("Error fetching model cards", error);
          });
      }, [])

    return (
        <div className='full-page-setup row'>
            <div className='col-3 bg-secondary bg-opacity-10 p-3 text-start'>
                <h5 className='fw-bold my-3'>Dataset</h5>
                <div className='d-flex flex-wrap'>
                    {modelCards.map((card, idx) => (
                        <div key={idx} 
                        onClick={() => {setSelectedTask(prevTask => prevTask === card.task ? null : card.task); setSelectedChip(prev => prev === idx ? null : idx)}} >
                          <ModelChip key={idx} name={card.task} selected={selectedChip === idx}/>
                        </div>
                    ))}
                </div>
            </div>
            <div className='col-9 d-flex flex-column align-items-center p-4'>
                <Link to="/"> <button className="btn font-sm mb-3 btn-general text-white bg-secondary bg-opacity-75">Back to main</button> </Link>
                <h2 className='fw-bold w-100 text-start'>Model Bazaar</h2>
                <hr className='w-100 text-body-tertiary m-0 mb-4'/>
                <div className='w-100 d-flex flex-wrap' style={{height: "70vh", overflowY: "scroll"}}>
                    {
                        modelCards.filter(card => !selectedTask || card.task === selectedTask).map((card, idx) => (
                            <ModelCard 
                                key={idx}
                                name={card.modelName} 
                                author={card.authorUsername}
                                description={card.modelDesc}
                                status={card.hasIndex ? 1: 0}
                                publishDate={card.publishDate} 
                                trainSet={card.dataset}
                                diskSize={`${(card.modelSize / 1024).toFixed(2)} GB`} 
                                ramSize={`${(card.modelSizeInMemory / 1024).toFixed(2)} GB`}
                                cached={cachedModels.some(cachedModel => cachedModel.identifier === `${card.authorUsername}/${card.modelName}`)}
                                setCurrentModel={setCurrentModel}
                            />
                        ))
                    }
                </div>
                
            </div>
            
        </div>
    )
}
