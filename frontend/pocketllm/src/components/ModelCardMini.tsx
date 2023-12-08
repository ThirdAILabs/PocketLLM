import { useState } from 'react'
import { usePort } from '../PortContext'
import axios from 'axios'
import ProgressCircular from './ProgressCircular'
import { ModelDisplayInfo } from '../App'
import { useNavigate } from 'react-router-dom'
import ModelCardFunctions from './ModelCardFunctions'
import { Model } from '../pages/ModelCards'
import useTelemetry from '../hooks/useTelemetry'

export type ModelCardProps = {
    name: string,
    modelName: string,
    author: string,
    description: string,
    status: Number,
    publishDate: string,
    trainSet: string,
    diskSize: string,
    ramSize: string,
    cached: boolean,
    setCachedModels: React.Dispatch<React.SetStateAction<Model[]>>,
    uninstallable: boolean,
    setCurrentModel: React.Dispatch<React.SetStateAction<ModelDisplayInfo | null>>
    setCurWorkSpaceID: (modelID: string | null) => void,
    progress: number,
    setProgress: React.Dispatch<React.SetStateAction<number>>,
    startProgress: boolean, 
    setStartProgress: React.Dispatch<React.SetStateAction<boolean>>,
}

export default function ModelCardMini({name, author, description, modelName, cached, setCachedModels, uninstallable, setCurrentModel, setCurWorkSpaceID,
                                        progress, setProgress, startProgress, setStartProgress}: ModelCardProps) {
    const { port } = usePort()

    // State variable to manage WebSocket connection
    const [_, setWebSocket] = useState<null | WebSocket>(null)
    const [isDownloaded, setIsDownloaded] = useState(false)

    const navigate = useNavigate()

    // For telemetry
    const recordEvent = useTelemetry()


    const useModel = async (domain: string, author_name: string, model_name: string) => {
        recordEvent({
            UserAction: 'Click',
            UIComponent: `Use-${model_name} button`,
            UI: 'ModelCardMini',
        })

        if (model_name === 'Default model' && author_name === 'thirdai') {
            const response = await axios.post(`http://localhost:${port}/reset_neural_db`)

            const data = response.data
    
            if (data.success) {
                console.log(data.msg)
                // Unselect current chosen workspace in <Sidebar/>
                setCurWorkSpaceID(null)
                setCurrentModel({
                    author_name: author_name,
                    model_name: model_name
                });
                // Redirect to /
                navigate('/')
            } else {
                console.error("Failed to set the model in the backend.")
            }
            return
        }

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
                // Unselect current chosen workspace in <Sidebar/>
                setCurWorkSpaceID(null)
                setCurrentModel({
                    author_name: author_name,
                    model_name: model_name
                });
                // Redirect to /
                navigate('/')
            } else {
                console.error("Failed to set the model in the backend.")
            }
    
        } catch (error) {
            console.error('Error:', error)
        }
    }

    const downloadModel = (domain: string, author_name: string, model_name: string) => {
        recordEvent({
            UserAction: 'Click',
            UIComponent: 'Download-expert-model button',
            UI: 'ModelCardMini',
        })

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
                if (data.progress === 100 && data.message.startsWith("Model downloaded at ")) {
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
        <>
            {
                uninstallable ?
                <div  
                    className='model-card-mini p-4 rounded-3 mb-3 me-3 d-flex flex-column align-items-center justify-content-between position-relative'
                    onClick={() => {
                        if ( isDownloaded || cached ) {
                            useModel('Public', author, modelName)
                        } else {
                            if (progress == 0) {
                                // Prevent double download: if user clicks download after the download already starts: multiple download will start.
                                downloadModel('Public', author, modelName)
                            }
                        }
                    }}
                    >
                    {
                        (isDownloaded || cached) && progress == 0 ?
                        <div className='model-card-functions'
                            onClick={(e) => {
                                e.stopPropagation()
                            }}>
                            <ModelCardFunctions author = {author} setIsDownloaded = {setIsDownloaded} setCachedModels = {setCachedModels} modelName = {modelName}/>
                        </div> 
                        :
                        <></>
                    }
                    
                    <div>
                        <div className='fw-bold mb-2'>{`${name}`}</div>
                        <div className='font-sm text-dark mb-2'>{description}</div>
                    </div>
                    <div className='d-flex w-100 justify-content-end'>
                        <div className='d-flex flex-column'>
                            {
                                (isDownloaded || cached) && progress == 0  ?
                                <i className="bi bi-arrow-right"></i>
                                :
                                <>
                                    {
                                        startProgress ?
                                        <ProgressCircular progress={progress}/>
                                        :
                                        <i className="bi bi-cloud-download fs-5"></i>
                                    }
                                </>
                            }
                        </div>
                    </div>
                </div>
                :
                <div  
                    className='model-card-mini p-4 rounded-3 mb-3 me-3 d-flex flex-column align-items-center justify-content-between position-relative'
                    onClick={isDownloaded || cached ? () => useModel('Public', author, modelName) : () => downloadModel('Public', author, modelName)}
                >
                    <div>
                        <div className='fw-bold mb-2'>{`${name}`}</div>
                        <div className='font-sm text-dark mb-2'>{description}</div>
                    </div>
                    <div className='d-flex w-100 justify-content-end'>
                        <div className='d-flex flex-column'>
                            <i className="bi bi-arrow-right"></i>
                        </div>
                    </div>
                </div>
            }
        </>
  )
}
