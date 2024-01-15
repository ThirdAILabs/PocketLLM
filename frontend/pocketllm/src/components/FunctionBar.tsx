import { useContext, useEffect, useRef, useState } from 'react'
import { Tooltip } from '@mui/material'

import { WorkSpaceFile } from '../App'
import Teach from "./Teach"
import LoadGmailDump from './GmailDump'
// import LoadGmail from './GmailLoad'
import LoadOutlook from './OutlookLoad'
import LoadUrl from './LoadUrl'
import LoadGithub from './LoadGithub'
import LoadSlack from './LoadSlack'
import SpecifySummarizer from './SpecifySummarizer'
import SelectFile from './SelectFile'
import { WorkSpaceMetadata } from '../App'
import { ModelDisplayInfo } from '../App'
import { FeatureUsableContext } from '../contexts/FeatureUsableContext'

import googleLogo from "../assets/gmail.svg";
import outlookLogo from "../assets/outlook.svg";

type FunctionBarProps = {
  selectedFiles: WorkSpaceFile[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<WorkSpaceFile[]>>;
  progress: number;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
  startProgress: boolean;
  setStartProgress: React.Dispatch<React.SetStateAction<boolean>>;
  currentModel: ModelDisplayInfo | null,
  specifySummerizerTrigger: React.RefObject<HTMLButtonElement>,
  summerizeFormTrigger: React.RefObject<HTMLButtonElement>,
  queryEnabled: Boolean,
  curWorkSpaceID: string|null,
  setCurWorkSpaceID: React.Dispatch<React.SetStateAction<string|null>>,
  setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
  summarizer: string | null, setSummarizer: (model: string | null) => void
  setCurrentUsage: React.Dispatch<React.SetStateAction<number>>,
  cachedOpenAIKey: string
};

export default function FunctionBar({selectedFiles, setSelectedFiles, 
                                    progress, setProgress, 
                                    startProgress, setStartProgress,
                                    summarizer, setSummarizer, specifySummerizerTrigger, summerizeFormTrigger, queryEnabled,  
    curWorkSpaceID, setCurWorkSpaceID, setWorkSpaceMetadata,
    currentModel,
    setCurrentUsage,
    cachedOpenAIKey
  }: FunctionBarProps) {

  const { isFeatureUsable } = useContext(FeatureUsableContext);

  // if (!isFeatureUsable) {
  //     // Render a message or alternative UI
  //     return (
  //       <Tooltip title = "Feature not available due to exceeded workspace usage. Please check subscriptions for upgrades." placement='bottom'>
  //         <button className='btn border-0 mx-1 mt-2 text-secondary text-opacity-75' onClick={(e)=>e.preventDefault()}>
  //           <i className="bi bi-box-arrow-in-right fs-5"></i>
  //             <div className='font-sm'>Upload</div>
  //         </button>
  //       </Tooltip>
      
  //     );
  // }

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
        <div className='d-flex align-items-center' ref={ref2}>
          <button className='btn mx-1' ref={ref}>
            <i className="bi bi-box-arrow-in-right fs-5"></i>
              <div className='font-sm'>Context</div>
          </button>
          <div className='d-flex align-items-center rounded-3 ms-1 p-1' style={{backgroundColor: "#F2F2F2"}}>
            <SelectFile
                    selectedFiles={selectedFiles}
                    setSelectedFiles={setSelectedFiles}
                    progress={progress}
                    setProgress={setProgress}
                    startProgress={startProgress}
                    setStartProgress={setStartProgress}
                    curWorkSpaceID = {curWorkSpaceID} setCurWorkSpaceID = {setCurWorkSpaceID} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                    currentModel = {currentModel}
                    setCurrentUsage = {setCurrentUsage}
            />
            <LoadUrl
                    curWorkSpaceID = {curWorkSpaceID} setCurWorkSpaceID = {setCurWorkSpaceID} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                    currentModel = {currentModel}
                    setCurrentUsage = {setCurrentUsage}
            />
            {
              ! isFeatureUsable
              ?
              <>
                <Tooltip title="Your monthly premium credits have exhausted. Consider 1) referring your friends (click on top left account profile box), 2) subscribing or 3) waiting until first day of next month to use this feature again.">
                    <div className='position-relative'>
                        <button type="button" 
                            className="btn mx-1 h-100"
                            onClick={(e)=>e.preventDefault()}
                        >
                            <img src={outlookLogo} style={{width: '20px'}} placeholder='Outlook'/>
                        </button>
                        <i className="bi font-sm bi-exclamation-circle-fill feature-not-available-mark text-secondary"></i>
                    </div>
                </Tooltip>

                <Tooltip title="Your monthly premium credits have exhausted. Consider 1) referring your friends (click on top left account profile box), 2) subscribing or 3) waiting until first day of next month to use this feature again.">
                  <div className='position-relative'>
                      <button type="button" 
                          className="btn px-2 mx-1 h-100"  
                          onClick={(e)=>e.preventDefault()}
                      >
                          <img src={googleLogo} placeholder='Gmail' style={{width: '25px'}}/>
                      </button>
                      <i className="bi font-sm bi-exclamation-circle-fill feature-not-available-mark text-secondary"></i>
                  </div>
              </Tooltip>
              </>
              :
              <>
                <LoadOutlook
                        setCurWorkSpaceID = {setCurWorkSpaceID} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                        currentModel = {currentModel}
                        setCurrentUsage = {setCurrentUsage}
                />
                
                <LoadGmailDump 
                        setCurWorkSpaceID = {setCurWorkSpaceID} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                        currentModel = {currentModel}
                        setCurrentUsage = {setCurrentUsage}
                />
              </>

            }
            <LoadGithub
                    setCurWorkSpaceID = {setCurWorkSpaceID} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                    currentModel = {currentModel}
                    setCurrentUsage = {setCurrentUsage}
            />
            <LoadSlack
                    setCurWorkSpaceID = {setCurWorkSpaceID} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                    currentModel = {currentModel}
                    setCurrentUsage = {setCurrentUsage}
            />
            {/* <LoadGmail
                    setCurWorkSpaceID = {setCurWorkSpaceID} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                    currentModel = {currentModel}
                    setCurrentUsage = {setCurrentUsage}
            /> */}
          </div>
          
        </div>
        
      </div>
      {
        queryEnabled ?
        <>
          <SpecifySummarizer cachedOpenAIKey = {cachedOpenAIKey} summarizer={summarizer} setSummarizer={setSummarizer}  trigger={specifySummerizerTrigger} formTrigger = {summerizeFormTrigger}/>
          <div className='short-vertical-line-xs mb-2 mx-2'></div>
          <Teach curWorkSpaceID = {curWorkSpaceID} setWorkSpaceMetadata = {setWorkSpaceMetadata}/>
        </>
        :
        <></>
      }
        
        
    </div>
  )
}
