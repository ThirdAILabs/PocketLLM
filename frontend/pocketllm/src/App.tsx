import { useEffect, useState, useRef } from 'react';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import axios from 'axios'

import ModelCards from "./pages/ModelCards";
import LandingAnimation from "./pages/LandingAnimation";
import TitleBar from "./components/TitleBar";
import UpdateModal from "./components/UpdateModal";
import MainPage from "./pages/MainPage";
import { usePort } from './PortContext'
import Subscribe from "./components/Subscribe";
import SaveNotice from './components/SaveNotice';
import { SearchResult } from './pages/MainPage'
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap/dist/js/bootstrap.bundle.js";
import "bootstrap-icons/font/bootstrap-icons.css";

import './App.css'
import "./styling.css";


export interface ModelDisplayInfo {
  author_name: string;
  model_name: string;
}

export interface WorkSpaceMetadata {
  workspaceID: string;
  workspaceName: string;
  model_info: ModelDisplayInfo;
  documents: WorkSpaceFile[];
  last_modified: string;
  isWorkSpaceSaved: boolean;
}

export interface WorkSpaceFile {
  fileName: string;
  filePath: string;
  uuid: string;
  isSaved: boolean;
}

function App() {
  const { port } = usePort()

  // Used inside <ModelCards/> 
  const [currentModel, setCurrentModel] = useState<ModelDisplayInfo | null>(null);

  // Intro visual effect
  const [landing, setLanding] = useState(<LandingAnimation/>);

  // Work Space ID: Currently chosen workspace
  // Used inside to keep track of current chosen workspace
  const [curWorkSpaceID, setCurWorkSpaceID] = useState<string|null>(null)

  // Trigger update modal
  const updateTrigger = useRef<HTMLButtonElement>(null);

  // Trigger specify summerizer
  const specifySummerizerTrigger = useRef<HTMLButtonElement>(null);

  // Control specify summarizer form
  const specifySummarizerFormTrigger = useRef<HTMLButtonElement>(null);

  // Trigger for subscription
  const subscribeTrigger = useRef<HTMLButtonElement>(null);

  // Trigger for save workspace notice
  // afterSaveResetCurWorkspace controls if setCurWorkSpaceID(null) happens inside <SaveNotice/> after user clicks save
  // allowUnsave controls if Delete button will appear inside <SaveNotice/>
  const saveTrigger = useRef<HTMLButtonElement>(null);
  const [afterSaveResetCurWorkspace, setAfterSaveResetCurWorkspace] = useState<boolean>(false)
  const [allowUnsave, setAllowUnsave] = useState<boolean>(false)

  // Workspace meta info
  const [workSpaceMetadata, setWorkSpaceMetadata] = useState<WorkSpaceMetadata[]>([])

  // Currently indexed files in workspace
  const [indexFiles, setIndexFiles] = useState<WorkSpaceFile[]>([])

  // Used inside searchbar and specify model
  const [summarizer, setSummarizer] = useState<string | null>(null)

  // Used inside <SearchBar/> and <Extraction/>
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])

  // Used inside <SearchBar/> and <Summary/>
  const [summaryResult, setSummaryResult] = useState<string>('')

  useEffect(()=>{
    setTimeout(()=>{
      setLanding(<></>)
    }, 3550)
  }, [])

  useEffect(() => {
    workSpaceMetadata.forEach(workspace => {
      console.log(`Workspace ID: ${workspace.workspaceID}`);
      console.log(`Workspace Name: ${workspace.workspaceName}`);
      console.log(`Model Author: ${workspace.model_info.author_name}`);
      console.log(`Model Name: ${workspace.model_info.model_name}`);
      workspace.documents.forEach(doc => {
        console.log(`Document Name: ${doc.fileName}`);
        console.log(`Document Path: ${doc.filePath}`);
        console.log(`Document UUID: ${doc.uuid}`);
        console.log(`Is Document Saved: ${doc.isSaved}`);
      });
      console.log(`Last Modified: ${workspace.last_modified}`);
      console.log(`Is Workspace Saved: ${workspace.isWorkSpaceSaved}`);
      console.log('----------------------------------------');
    });
  }, [workSpaceMetadata]);

  // Triggered when a different workspace is loaded or
  // An existing workspace is changed (e.g. index new files)
  useEffect(() => {
    setSearchResults([])
    setSummaryResult('')

    // If workspace is not null, load the workspace's info
    if (curWorkSpaceID) {
        const currentWorkspace = workSpaceMetadata.find(ws => ws.workspaceID === curWorkSpaceID)
        if (currentWorkspace) {
            const files = currentWorkspace.documents
            setIndexFiles(files)
            setCurrentModel(currentWorkspace.model_info)
        }
    } else {
        // Otherwise, set everything back to not set
        setIndexFiles([])
        setCurrentModel(null)
    }
  }, [curWorkSpaceID, workSpaceMetadata])

  // Triggered only once at beginning to load workspace info from disk
  useEffect(() => {
    if (port) {
      const handleServerReady = async () => {
        try {
          // Fetch the list of workspaces
          const responseModels = await axios.get(`http://localhost:${port}/get_cached_workspace_metajson`)
          let workspaces: WorkSpaceMetadata[] = responseModels.data

          // Since loaded from disk, set all workspace's isWorkSpaceSaved to true
          workspaces = workspaces.map(workspace => ({ ...workspace, isWorkSpaceSaved: true }))

          setWorkSpaceMetadata(workspaces)
        } catch (error) {
            console.error('Error fetching models:', error)
        }
      }
  
      window.electron.on('server-ready', handleServerReady)
    }
  }, [port])

  useEffect(() => {
      window.electron.on('update-available', () => {
          updateTrigger?.current?.click()
      })
  }, [])

  return (

    <div className='full-page-height p-0'>
    
        <UpdateModal trigger = {updateTrigger}/>
        <Subscribe trigger = {subscribeTrigger}/>
        <SaveNotice trigger = {saveTrigger}
                    workSpaceMetadata={workSpaceMetadata} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                    setCurWorkSpaceID = {setCurWorkSpaceID}
                    afterSaveResetCurWorkspace = {afterSaveResetCurWorkspace}
                    allowUnsave = {allowUnsave}/>
        <Router>
          <Routes>

              <Route path="/ModelCards" element={<ModelCards setCurWorkSpaceID = {setCurWorkSpaceID} setCurrentModel={setCurrentModel} />} />
              
              <Route path="/" 
              element = {
                <MainPage currentModel={currentModel} 
                          specifySummerizerTrigger={specifySummerizerTrigger} 
                          specifySummarizerFormTrigger = {specifySummarizerFormTrigger}
                          indexFiles = {indexFiles}
                          queryEnabled = {indexFiles.length != 0}
                          curWorkSpaceID = {curWorkSpaceID}
                          setCurWorkSpaceID = {setCurWorkSpaceID}
                          workSpaceMetadata = {workSpaceMetadata}  setWorkSpaceMetadata = {setWorkSpaceMetadata}
                          summarizer = {summarizer} setSummarizer = {setSummarizer}
                          searchResults = {searchResults} setSearchResults = {setSearchResults}
                          summaryResult = {summaryResult} setSummaryResult = {setSummaryResult}
                          saveWorkSpaceTrigger = {saveTrigger}  
                          setAfterSaveResetCurWorkspace = {setAfterSaveResetCurWorkspace} setAllowUnsave = {setAllowUnsave}
                />
              }>

              </Route>

          </Routes>
          <TitleBar workSpaceMetadata = {workSpaceMetadata} 
                    subscribeTrigger={subscribeTrigger} 
                    curWorkSpaceID = {curWorkSpaceID} 
                    setCurWorkSpaceID = {setCurWorkSpaceID} 
                    setWorkSpaceMetadata = {setWorkSpaceMetadata} 
                    saveWorkSpaceTrigger = {saveTrigger}
                    setAfterSaveResetCurWorkspace = {setAfterSaveResetCurWorkspace} setAllowUnsave = {setAllowUnsave}
                    />
        </Router>
      {landing}
    </div>

  )
}

export default App
