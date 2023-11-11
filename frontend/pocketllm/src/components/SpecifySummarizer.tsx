import { useState, FormEvent, useEffect, useRef } from 'react'
import axios from 'axios'
import { usePort } from '../PortContext'

import SpecifySummarizerNotice from './SpecifySummarizerNotice';

type SpecifyModelProps = {
    summarizer: string | null, setSummarizer: (model: string | null) => void
    trigger: React.RefObject<HTMLButtonElement>;
    formTrigger: React.RefObject<HTMLButtonElement>;
};

export default function SpecifySummarizer( {summarizer , setSummarizer, trigger, formTrigger}: SpecifyModelProps ) {
    const { port } = usePort()

    const [value, setValue] = useState<string|null>(null);

    const [notice, setNotice] = useState(<></>);

    const [openAiApiKey, setOpenAiApiKey] = useState("");

    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(()=>{
        setValue(summarizer);
    }, [summarizer])

    function giveNotice(noticeType: String, noticeInfo: String) {
        setNotice(
            <SpecifySummarizerNotice noticeType={noticeType} noticeInfo={noticeInfo}/>
        )
        setTimeout(()=>{
            setNotice(<></>);
        }, 5000)
    }

    const handleContinue = async (e: FormEvent) => {
        e.preventDefault();

        if (value === "OpenAI" && openAiApiKey == "") {
            giveNotice("warning", "Please set OpenAPI key below.");
            return;
        }

        const payload = {
            model_preference: value,
            open_ai_api_key: value === "OpenAI" ? openAiApiKey : "",
        };

        try {
            const response = await axios.post(`http://localhost:${port}/setting`, payload);
            if (response.data.success) {
                giveNotice("success", "Summary model set.");
                setTimeout(()=>{
                    closeRef.current?.click();
                }, 1000)
                
            } else {
                giveNotice("warning", "Failed to set summary model.")
            }
        } catch (error) {
            console.error("Error updating settings:", error);
        }
    };

  return (
    <>
        <button ref={trigger} className='btn btn-general mx-1' data-bs-toggle="modal" data-bs-target="#specifyModal">
            <i className="bi bi-gear-wide-connected" style={{fontSize: "13.5pt"}}></i>
            <div className='font-sm'>Summarizer</div>
        </button>

        <div className="modal fade" id="specifyModal" tabIndex={-1} aria-hidden="true">
            <div className="modal-dialog specify-model-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header border-0 ">
                        <button type="button" ref={closeRef} className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div className="modal-body pt-0 px-3">
                        <div className='font-sm fw-bold mb-2'>Specify Summary Model</div>
                        <div className='font-x-sm mb-3'>Please Specify a model to be used for summary generation. This choice can be modified later.</div>
                        <form onSubmit={handleContinue} name='summarizeForm' noValidate>
                            <div className='summary-model-wrapper mb-3 font-sm text-start'>
                                
                                <div className='mb-2'>Summary model</div>
                                <div className='d-flex justify-content-between'>
                                    <div className="form-check form-check-inline me-0">
                                        <input className="form-check-input" type="radio" name="inlineRadioOptions" id="inlineRadio1" value="None" checked={summarizer == "None"}
                                            onChange={()=>{setValue("None"); setSummarizer('None')}}
                                        />
                                        <label className="form-check-label" htmlFor="inlineRadio1">None</label>
                                    </div>

                                    <div className="form-check form-check-inline me-0">
                                        <input className="form-check-input" type="radio" name="inlineRadioOptions" id="inlineRadio2" value="ThirdAI" checked={summarizer == "ThirdAI"}
                                            onChange={()=>{setValue("ThirdAI"); setSummarizer('ThirdAI')}}
                                        />
                                        <label className="form-check-label" htmlFor="inlineRadio2">ThirdAI</label>
                                    </div>

                                    <div className="form-check form-check-inline me-1">
                                        <input className="form-check-input" type="radio" name="inlineRadioOptions" id="inlineRadio3" value="OpenAI" checked={summarizer == "OpenAI"}
                                            onChange={()=>{setValue("OpenAI"); setSummarizer('OpenAI')}}
                                        />
                                        <label className="form-check-label" htmlFor="inlineRadio3">OpenAI</label>
                                    </div>
                                </div>
                                

                                <hr className='text-body-tertiary my-2'/>

                                <div className='font-x-sm mb-3'>
                                    {
                                        summarizer == "None" ?
                                        <div>No summarizer is selected</div>
                                        :
                                        summarizer == "ThirdAI" ?
                                        <div> <b>Privacy Notice:</b> ThirdAI summarizer is a completely private model for simple use cases.</div>
                                        :
                                        <div><b>Privacy Notice:</b> OpenAI summarizer is not privacy oriented: your data will go to OpenAI server.</div>
                                    }
                                </div>

                                <div className='d-flex justify-content-between align-items-center' style={{visibility: `${summarizer == "OpenAI" ? "visible" : "hidden"}`}}>
                                    <span>OpenAI API key</span>
                                    <input className="form-control form-control-sm api-input" type="text" onChange={(e) => setOpenAiApiKey(e.target.value)} required/>
                                </div>

                            </div>

                            <div className='d-flex justify-content-center mb-3'>
                                <button className='btn bg-secondary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1' type='submit' ref={formTrigger}>
                                    Continue
                                </button>
                            </div>
                        </form>
                        
                    </div>
                    {notice}
                    
                </div>
            </div>
        </div>
    </>
  )
}
