import { useState, FormEvent } from 'react'
import axios from 'axios'
import { usePort } from '../PortContext'

type SpecifyModelProps = {
    setModel: (model: string) => void;
};

export default function SpecifyModel( {setModel}: SpecifyModelProps ) {
    const { port } = usePort()

    const [value, setValue] = useState("None");

    const [openAiApiKey, setOpenAiApiKey] = useState("");

    const handleContinue = async (e: FormEvent) => {
        e.preventDefault()

        const payload = {
            model_preference: value,
            open_ai_api_key: value === "OpenAI" ? openAiApiKey : "",
        };

        try {
            const response = await axios.post(`http://localhost:${port}/setting`, payload);
            console.log(response.data);
        } catch (error) {
            console.error("Error updating settings:", error);
        }
    };

  return (
    <>
        <span className='input-group-text bg-transparent rounded-end-3'>
            <i className="bi bi-gear-wide-connected gear text-dark-emphasis" data-bs-toggle="modal" data-bs-target="#specifyModal"></i>
        </span>

        <div className="modal fade" id="specifyModal" tabIndex={-1} aria-hidden="true">
            <div className="modal-dialog specify-model-dialog">
                <div className="modal-content">
                    <div className="modal-header border-0 ">
                        <button type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div className="modal-body pt-0 px-3">
                        <div className='font-sm fw-bold mb-2'>Specify Summary Model</div>
                        <div className='font-x-sm mb-3'>Please Specify a model to be used for summary generation. This choice can be modified later.</div>
                        <div className='summary-model-wrapper mb-3 font-sm text-start'>
                            <div className='mb-2'>Summary model</div>
                            <div className='d-flex justify-content-between'>
                                <div className="form-check form-check-inline me-0">
                                    <input className="form-check-input" type="radio" name="inlineRadioOptions" id="inlineRadio1" value="None" checked={value == "None"}
                                        onChange={()=>{setValue("None"); setModel('None')}}
                                    />
                                    <label className="form-check-label" htmlFor="inlineRadio1">None</label>
                                </div>

                                <div className="form-check form-check-inline me-0">
                                    <input className="form-check-input" type="radio" name="inlineRadioOptions" id="inlineRadio2" value="ThirdAI" checked={value == "ThirdAI"}
                                        onChange={()=>{setValue("ThirdAI"); setModel('ThirdAI')}}
                                    />
                                    <label className="form-check-label" htmlFor="inlineRadio2">ThirdAI</label>
                                </div>

                                <div className="form-check form-check-inline me-1">
                                    <input className="form-check-input" type="radio" name="inlineRadioOptions" id="inlineRadio3" value="OpenAI" checked={value == "OpenAI"}
                                        onChange={()=>{setValue("OpenAI"); setModel('OpenAI')}}
                                    />
                                    <label className="form-check-label" htmlFor="inlineRadio3">OpenAI</label>
                                </div>
                            </div>
                            

                            <hr className='text-body-tertiary my-2'/>

                            <div className='d-flex justify-content-between align-items-center' style={{visibility: `${value == "OpenAI" ? "visible" : "hidden"}`}}>
                                <span>OpenAI API key</span>
                                <input className="form-control form-control-sm api-input" type="text" onChange={(e) => setOpenAiApiKey(e.target.value)}/>
                            </div>

                        </div>

                        <div className='d-flex justify-content-center mb-3'>
                            <button className='btn bg-secondary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                    onClick={ handleContinue } >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </>
  )
}
