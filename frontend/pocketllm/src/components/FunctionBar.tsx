import { useEffect, useRef, useState } from 'react'

import { WorkSpaceFile } from '../App'
import Teach from "./Teach"
import LoadGmail from './GmailLoad'
import LoadUrl from './LoadUrl'
import SpecifySummarizer from './SpecifySummarizer'
import SelectFile from './SelectFile'
import { WorkSpaceMetadata } from '../App'
import { ModelDisplayInfo } from '../App'

type FunctionBarProps = {
  currentModel: ModelDisplayInfo | null,
  specifySummerizerTrigger: React.RefObject<HTMLButtonElement>,
  summerizeFormTrigger: React.RefObject<HTMLButtonElement>,
  queryEnabled: Boolean,
  curWorkSpaceID: string|null,
  setCurWorkSpaceID: React.Dispatch<React.SetStateAction<string|null>>,
  setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
  summarizer: string | null, setSummarizer: (model: string | null) => void
};

export default function FunctionBar({summarizer, setSummarizer, specifySummerizerTrigger, summerizeFormTrigger, queryEnabled,  
                                    curWorkSpaceID, setCurWorkSpaceID, setWorkSpaceMetadata,
                                    currentModel
                                  }: FunctionBarProps) {
  const [selectedFiles, setSelectedFiles] = useState<WorkSpaceFile[]>([]);
  const [progress, setProgress] = useState(0);
  const [startProgress, setStartProgress] = useState(false);

  // input animation
  const ref = useRef<HTMLButtonElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState("55px");

  useEffect(()=>{
    setWidth(`${ref.current?.clientWidth? (ref.current.clientWidth): "55"}px`);
}, [])

  return (
    <div className='d-flex mb-3 align-items-end justify-content-center'>
      <div className='d-flex align-items-end'
        style={{width: `${width}`, overflow: "hidden", transition: "all 1s ease"}}
        onMouseEnter={()=>{setWidth(`${ref2.current?.clientWidth? (ref2.current.clientWidth): "195"}px`)}}
        onMouseLeave={()=>{setWidth(`${ref.current?.clientWidth? (ref.current.clientWidth): "55"}px`)}}
      >
        <div className='d-flex align-items-end' ref={ref2}>
          <button className='btn mx-1' ref={ref}>
            <i className="bi bi-box-arrow-in-right fs-5"></i>
              <div className='font-sm'>Upload</div>
          </button>
          <div className='d-flex align-items-end bg-secondary bg-opacity-25 rounded-3 ms-1 p-1'>
            <SelectFile
                    selectedFiles={selectedFiles}
                    setSelectedFiles={setSelectedFiles}
                    progress={progress}
                    setProgress={setProgress}
                    startProgress={startProgress}
                    setStartProgress={setStartProgress}
                    curWorkSpaceID = {curWorkSpaceID} setCurWorkSpaceID = {setCurWorkSpaceID} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                    currentModel = {currentModel}
            />
            <LoadUrl
                    curWorkSpaceID = {curWorkSpaceID} setCurWorkSpaceID = {setCurWorkSpaceID} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                    currentModel = {currentModel}
            />
            <LoadGmail
                    setCurWorkSpaceID = {setCurWorkSpaceID} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                    currentModel = {currentModel}
            />
          </div>
          
        </div>
        
      </div>
      {
        queryEnabled ?
        <>
          <SpecifySummarizer summarizer={summarizer} setSummarizer={setSummarizer}  trigger={specifySummerizerTrigger} formTrigger = {summerizeFormTrigger}/>
          <div className='short-vertical-line-xs mb-2 mx-2'></div>
          <Teach/>
        </>
        :
        <></>
      }
        
        
    </div>
  )
}
