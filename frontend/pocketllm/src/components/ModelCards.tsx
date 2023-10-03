import { useEffect, useState } from 'react'
import ModelCard from "./ModelCard"
import axios from 'axios'
import { Link } from 'react-router-dom';
import ModelChip from './ModelChip';
import { usePort } from '../PortContext'

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

export default function ModelCards() {
    const { port } = usePort()

    const [modelCards, setModelCards] = useState<ModelCardData[]>([])

    useEffect(() => {
        // console.log(`port is ${port}`)

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
                    <ModelChip name="English QnA datasets"/>
                    <ModelChip name="Food Receipes"/>
                    <ModelChip name="FiQA"/>
                    <ModelChip name="FiQA"/>
                    <ModelChip name="English QnA datasets"/>
                </div>
                
            </div>
            <div className='col-9 d-flex flex-column align-items-center p-4'>
                <Link to="/"> <button className="btn font-sm mb-3 btn-general text-white bg-secondary bg-opacity-75">Back to main</button> </Link>
                <h2 className='fw-bold w-100 text-start'>Model Bazaar</h2>
                <hr className='w-100 text-body-tertiary m-0 mb-4'/>
                <div className='w-100 d-flex flex-wrap' style={{height: "70vh", overflowY: "scroll"}}>
                    {
                        modelCards.map( (card, idx) => (
                            <ModelCard 
                                key={idx}
                                name={card.modelName} 
                                description={card.modelDesc}
                                status={card.hasIndex ? 1: 0} // Replace with the actual status from card if available
                                publishDate={card.publishDate} 
                                trainSet={card.dataset}
                                diskSize={`${(card.modelSize / 1024).toFixed(2)} GB`} 
                                ramSize={`${(card.modelSizeInMemory / 1024).toFixed(2)} GB`}
                        />))
                    }
                </div>
                
            </div>
            
        </div>
    )
}
