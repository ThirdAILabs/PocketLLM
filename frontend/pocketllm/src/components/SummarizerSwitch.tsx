import { useEffect, useState } from 'react';
import axios from 'axios'

import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';

import { SummarizerType } from '../App'
import { usePort } from '../contexts/PortContext'

type summarizerSwitchProps = {
    summarizer: SummarizerType | null, setSummarizer: React.Dispatch<React.SetStateAction<SummarizerType | null>>, cachedOpenAIKey: string, setCachedOpenAIKey: React.Dispatch<React.SetStateAction<string>>
}


const style = {
    position: 'absolute' as 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    borderRadius: 2,
    width: 400,
    bgcolor: 'background.paper',
    boxShadow: 24,
    p: 4,
}

export default function SummarizerSwitch(
    {summarizer, setSummarizer, cachedOpenAIKey, setCachedOpenAIKey}
    : summarizerSwitchProps
) {
    const { port } = usePort()
    
    const [open, setOpen] = useState(false)
    const [isOpenAIOn, setUseOpenAI] = useState(false)
    const [openAiApiKey, setOpenAiApiKey] = useState('')

    useEffect(()=>{
        setOpenAiApiKey(cachedOpenAIKey)
        setUseOpenAI(summarizer === SummarizerType.OpenAI)
    },[summarizer, cachedOpenAIKey])

    const clickToggle = () =>{
        if (isOpenAIOn) {
            setUseOpenAI(false)
            setSummarizer(null)
        } else {
            setOpen(true)
        }
    }

    const handleSubmit = async (key: string) => {
        const trimmedApiKey = key.trim()
        if (trimmedApiKey) {
            const response = await axios.post(`http://localhost:${port}/setting`, {
                model_preference: SummarizerType.OpenAI,
                open_ai_api_key: trimmedApiKey,
            })

            if (response.data.success) {
                setUseOpenAI(true)
                setCachedOpenAIKey(trimmedApiKey)
                setSummarizer(SummarizerType.OpenAI)
            }
        }

        setOpen(false)
    }

    return (
        <>
            <div className="form-check form-switch me-5 d-flex align-items-center mb-3 ms-3" >
                <input  className="form-check-input" 
                        type="checkbox" role="switch" id="flexSwitchCheckDefault"
                        style={{opacity: "0.75"}}
                        onChange={clickToggle}
                        checked = {isOpenAIOn}
                />
                <label className="font-sm ms-1 mt-1" htmlFor="flexSwitchCheckDefault">OpenAI</label>
            </div>

            <Modal
                open={open}
                onClose={()=>setOpen(false)}
                aria-labelledby="modal-modal-title"
                aria-describedby="modal-modal-description"
            >
                <Box sx={style}>
                    <div>
                        <div className="border-0 d-flex justify-content-end">
                            <button type="button" className="btn-close modal-close-btn" 
                            onClick={()=>setOpen(false)}
                            
                            ></button>
                        </div>
                        <div className="pt-0 px-3">
                            <form name='summarizeForm' noValidate>
                                <div className='mb-3 p-3 font-sm'>

                                    <div className='font-sm mb-4 text-center'>
                                        <div>OpenAI summarizer is <b>not private</b></div>
                                    </div>

                                    <div className='d-flex justify-content-between align-items-center'>
                                        <span>OpenAI API key</span>
                                        <input className="form-control form-control-sm api-input" type="text" value={cachedOpenAIKey} onChange={(e) => setOpenAiApiKey(e.target.value)} required/>
                                    </div>

                                </div>

                                <div className='d-flex justify-content-center mb-3'>
                                    <button 
                                            className='btn bg-secondary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1' 
                                            type='button' 
                                            onClick={()=>setOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                            className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1' 
                                            type='button'
                                            onClick={()=>handleSubmit(openAiApiKey)}
                                    >
                                        Continue
                                    </button>
                                </div>
                            </form>
                            
                        </div>
                    </div>
                </Box>
                
            </Modal>
        </>
    )
}