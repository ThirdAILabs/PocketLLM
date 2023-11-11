import React, { useEffect } from 'react'

import {ModelDisplayInfo} from "../App";
import SearchBar from '../components/searchBar';
import ModelName from '../components/ModelNameTemplate';
import FunctionBar from '../components/FunctionBar';
import Summary from '../components/Summary';
import Extraction from '../components/Extraction';
import SelectedFileList from '../components/SelectedFileList';
import { WorkSpaceFile } from '../App'
import { WorkSpaceMetadata } from '../App'

export interface SearchResult {
    page_high: number
    page_low: number
    result_source: string
    result_text: string
    result_type: string
}

type MainPageProps = {
  currentModel: ModelDisplayInfo | null,
  specifySummerizerTrigger: React.RefObject<HTMLButtonElement>,
  specifySummarizerFormTrigger: React.RefObject<HTMLButtonElement>,
  indexFiles: WorkSpaceFile[],
  queryEnabled: boolean,
  curWorkSpaceID: string|null,
  setCurWorkSpaceID: React.Dispatch<React.SetStateAction<string|null>>,
  workSpaceMetadata: WorkSpaceMetadata[], setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>,
  summarizer: string | null, setSummarizer: (model: string | null) => void,
  searchResults: SearchResult[], setSearchResults: (results: SearchResult[]) => void,
  summaryResult: string, setSummaryResult: (result: string) => void,
  saveWorkSpaceTrigger: React.RefObject<HTMLButtonElement>,
  setAfterSaveResetCurWorkspace: React.Dispatch<React.SetStateAction<boolean>>, setAllowUnsave: React.Dispatch<React.SetStateAction<boolean>>,
  setCurrentUsage: React.Dispatch<React.SetStateAction<number>>
}

export default function MainPage({currentModel, specifySummerizerTrigger,specifySummarizerFormTrigger, 
                                  indexFiles, 
                                  queryEnabled,
                                  curWorkSpaceID, setCurWorkSpaceID, workSpaceMetadata, setWorkSpaceMetadata,
                                  summarizer, setSummarizer,
                                  searchResults, setSearchResults,
                                  summaryResult, setSummaryResult,
                                  saveWorkSpaceTrigger, setAfterSaveResetCurWorkspace, setAllowUnsave,
                                  setCurrentUsage
                                }: MainPageProps) {

  function openAISetKeyNotice() {
      setSummarizer("OpenAI");
      specifySummerizerTrigger?.current?.click();
      specifySummarizerFormTrigger?.current?.click();
  }

  const handleSaveKeyPress = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()

      console.log("User typed ctrl+s to save workspace")

      const currentWorkspace = workSpaceMetadata.find(workspace => workspace.workspaceID === curWorkSpaceID);
      if (currentWorkspace && ! currentWorkspace.isWorkSpaceSaved) {
        // If current workspace exists and unsaved
        console.log("Trying to save current unsaved workspace")

        // Because user probably wants to stay inside current workpsace, both afterSaveResetCurWorkspace and afterUnSaveResetBackFrontend should be false
        setAfterSaveResetCurWorkspace(false)
        setAllowUnsave(false)

        saveWorkSpaceTrigger.current?.click()
      }
    }
  }

  useEffect(()=>{
    window.addEventListener("keydown", handleSaveKeyPress);
    return () => {
      window.removeEventListener("keydown", handleSaveKeyPress);
    };
  }, [curWorkSpaceID, workSpaceMetadata])

  return (
    <div className='w-100 h-100 d-flex flex-column justify-content-between model-cards-wrapper'>
      <div className="w-100 h-100 mt-5 mb-2" style={{maxHeight: "95vh", overflowY: "auto"}}>
        <div className='d-flex flex-column align-items-center'>
          <div className='d-flex mb-3 align-items-center justify-content-center pt-5' style={{marginTop:'130px'}}>
            <ModelName modelInfo = {currentModel}/>
          </div>

          <SelectedFileList indexFiles = {indexFiles} queryEnabled={queryEnabled}
                            workSpaceMetadata = {workSpaceMetadata} curWorkSpaceID = {curWorkSpaceID} 
                            saveWorkSpaceTrigger = {saveWorkSpaceTrigger} 
                            setAfterSaveResetCurWorkspace = {setAfterSaveResetCurWorkspace}
                            setAllowUnsave = {setAllowUnsave}/>

          <FunctionBar  summarizer={summarizer} setSummarizer={setSummarizer} 
                        specifySummerizerTrigger={specifySummerizerTrigger} summerizeFormTrigger = {specifySummarizerFormTrigger} queryEnabled={queryEnabled}
                        curWorkSpaceID = {curWorkSpaceID} setCurWorkSpaceID = {setCurWorkSpaceID} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                        currentModel = {currentModel}
                        setCurrentUsage = {setCurrentUsage}/>

          <SearchBar onSearch = {setSearchResults} onSummary = {setSummaryResult} summarizer={summarizer} queryEnabled={queryEnabled}/>

          <div style={{minWidth: "60vw", maxWidth: "70vw"}}>
            <Summary summary = {summaryResult}/>
            <Extraction searchResults={searchResults} openAISetKeyNotice={openAISetKeyNotice}/>
          </div>
        </div>
            
      </div>
      <div className='font-x-sm mb-3'>Terms of <a target='_blank' href="https://www.thirdai.com/terms-of-service-for-thirdai-pocketllm/">Service</a> and <a target='_blank' href="https://www.thirdai.com/privacy-policy-pocketllm/">Privacy Policy</a>.</div>
    </div>
    
  )
}
