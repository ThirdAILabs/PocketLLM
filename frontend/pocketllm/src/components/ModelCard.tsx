import { useState } from 'react'
import { usePort } from '../PortContext'
import axios from 'axios'
import ProgressCircular from './ProgressCircular'

export type ModelCardProps = {
    name: String,
    author: String,
    description: String,
    status: Number,
    publishDate: String,
    trainSet: String,
    diskSize: String,
    ramSize: String,
    cached: boolean
}

export default function ModelCard({name, author, description, status, publishDate, trainSet, diskSize, ramSize, cached}: ModelCardProps) {
    const { port } = usePort()

    // State variable to manage WebSocket connection
    const [_, setWebSocket] = useState<null | WebSocket>(null)
    const [progress, setProgress] = useState(0)
    const [startProgress, setStartProgress] = useState(false)
    const [isDownloaded, setIsDownloaded] = useState(false)


    const useModel = async (domain: String, author_name: String, model_name: String) => {
        try {
            const response = await axios.post(`http://localhost:${port}/use_model`, {
                domain: domain,
                model_name: model_name,
                author_username: author_name
            })

            const data = response.data
            console.log(data)
    
            if (data.success) {
                console.log(data.msg);
            } else {
                console.error("Failed to set the model in the backend.")
            }
    
        } catch (error) {
            console.error('Error:', error)
        }
    }

    const downloadModel = (domain: String, author_name: String, model_name: String) => {
        try {
            // Initialize the WebSocket connection when the button is clicked
            const ws = new WebSocket(`ws://localhost:${port}/fetch_base_model`);
    
            ws.onopen = () => {
                console.log('WebSocket Client Connected');
                
                // Set initial progress (or any other UI elements you want to initialize)
                setStartProgress(true);
    
                // Send a message to the server to start downloading the model
                ws.send(JSON.stringify({ 
                    domain: domain, 
                    model_name: model_name, 
                    author_username: author_name 
                }));
            };
        
            ws.onmessage = (message) => {
                const data = JSON.parse(message.data);
                setProgress(data.progress);
                console.log(data.progress, data.message);
    
                // Once download completes
                if (data.progress === 100) {
                    setIsDownloaded(true)

                    setTimeout(() => {
                        setStartProgress(false);
                        setProgress(0);
                        // Any other post-download tasks you'd like to execute can go here
                    }, 500);
                }
            };
        
            ws.onerror = (error) => {
                console.error(`WebSocket Error: ${error}`);
            };
        
            ws.onclose = () => {
                console.log('WebSocket connection closed');
                setWebSocket(null);
                setStartProgress(false);
            };
            
            setWebSocket(ws);
    
        } catch (error) {
            console.error('Error:', error);
            setStartProgress(false);
        }
    }

    return (
    <div  className='model-card p-4 rounded-3 mb-3 d-flex flex-column justify-content-between'>
        <div>
            <div className='fw-bold'>{"thirdai / " + name}</div>
            <div className='font-sm text-dark mb-2'>{description}</div>
        </div>


        <div className='d-flex align-items-start'>
            {
                status === 0 ?
                <i className="bi bi-check-circle-fill text-primary fs-4"></i>
                :
                <i className="bi bi-exclamation-circle-fill text-success fs-4"></i>
            }
            <div className='d-flex align-items-end'>
                <div className='mx-3 pt-2'>
                    <div className='fw-bold' style={{fontSize: "11pt"}}> {status === 0 ? 'Add your documents' : 'Shipped with documents'}</div>
                    <div className='text-secondary my-1'style={{fontSize: "9pt"}}>{"Published " + publishDate}</div>
                    <div className='text-secondary my-1'style={{fontSize: "9pt"}}>{"Trained on " + trainSet}</div>
                    <div className='text-secondary my-1'style={{fontSize: "9pt"}}>{"On-disk: " + diskSize + ", RAM: " + ramSize}</div>
                </div>
                {
                    isDownloaded || cached ?
                    <button onClick={() => useModel('Public', author, name)} className='btn btn-general px-3 fw-bold bg-primary bg-opacity-10 text-primary rounded-4'>USE</button>
                    :
                    <button onClick={() => downloadModel('Public', author, name)} className='btn btn-general px-3 fw-bold text-primary'>
                        {
                            startProgress ?
                            <ProgressCircular progress={progress}/>
                            :
                            <i className="bi bi-cloud-download fs-2"></i>
                        }
                        
                    </button>
                }
            </div>
        </div>
    </div>
  )
}
