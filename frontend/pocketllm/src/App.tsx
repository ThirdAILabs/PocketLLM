import { useEffect, useState, useRef } from 'react';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import axios from 'axios'

import ModelCards from "./pages/ModelCards";
import LandingAnimation from "./pages/LandingAnimation";
import TitleBar from "./components/TitleBar";
import AppUpdater from "./components/AppUpdater";
import MainPage from "./pages/MainPage";
import { usePort } from './PortContext'
import Subscribe from "./components/Subscribe";
import SaveNotice from './components/SaveNotice';
import { SearchResult } from './pages/MainPage'
import { FeatureUsableContext } from './contexts/FeatureUsableContext';
import { SetAlertMessageProvider } from './contexts/SetAlertMessageContext'
import CustomAlertWrapper from './components/CustomAlertWrapper';
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
  fileSize: number;
  uuid: string;
  isSaved: boolean;
}

export enum SubscriptionPlan {
  FREE = "FREE",
  PREMIUM = "PREMIUM",
  SUPREME = "SUPREME"
}

function App() {
  const { port } = usePort()

  // Used inside <ModelCards/> 
  const [currentModel, setCurrentModel] = useState<ModelDisplayInfo | null>(null);
  const [modelDownloadProgress, setModelDownloadProgress] = useState(0)
  const [startModelDownloadProgress, setStartModelDownloadProgress] = useState(false)

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

  // Alert trigger
  const [alertMessage, setAlertMessage] = useState<string>("");

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

  // User gmail name and email
  const [user, setUser] = useState<{ email: string, name: string, subscription_plan: SubscriptionPlan  } | null>(null)

  // User current usage
  const [currentUsage, setCurrentUsage] = useState(0)

  // User can / cannot continue using the app
  const [isFeatureUsable, setIsFeatureUsable] = useState(true)

  // Used inside <FunctionBar> to keep track of training progress
  const [selectedFiles, setSelectedFiles] = useState<WorkSpaceFile[]>([]);
  const [progress, setProgress] = useState(0);
  const [startProgress, setStartProgress] = useState(false);

  // User cached OpenAI key
  const [cachedOpenAIKey, setCachedOpenAIKey] = useState<string>('')

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
  // An existing workspace is changed (e.g. index new files, upvoted, teaching)
  useEffect(() => {

    // If workspace is not null, load the workspace's info
    if (curWorkSpaceID) {
        const currentWorkspace = workSpaceMetadata.find(ws => ws.workspaceID === curWorkSpaceID)
        if (currentWorkspace) {
            const files = currentWorkspace.documents
            if (files.length === indexFiles.length) {
              // Upvote, teaching
              console.log('Workspace change: Upvote, teaching')
            } else {
              // index new files
              console.log('Workspace change: index new files')
              setSearchResults([])
              setSummaryResult('')
            }
            setIndexFiles(files)
            setCurrentModel(currentWorkspace.model_info)
        }
    } else {
        // Otherwise, set everything back to not set
        setIndexFiles([])
        setCurrentModel(null)
        setSearchResults([])
        setSummaryResult('')
    }
  }, [curWorkSpaceID, workSpaceMetadata])

  // Triggered when currentUsage changes
  useEffect(() => {
    // Function to write the updated usage to file
    const writeUpdatedUsageToFile = async (newSize: number) => {
      try {
        const result = await window.electron.invoke('update-usage', newSize)
        console.log('Usage size updated in file:', result); // result should be 'success'
      } catch (error) {
        console.error('Error sending update usage to main process:', error)
      }
    }
  
    // Call the function with the new size whenever currentUsage changes
    if ( currentUsage !== 0 )
      writeUpdatedUsageToFile(currentUsage)
  }, [currentUsage])

  useEffect(() => {
    // A user can use features if they haven't exceeded the usage limit
    // or if they are logged in (not null) and their subscription plan is not FREE.
    const canUseFeature = currentUsage <= 200 || (user && user.subscription_plan !== SubscriptionPlan.FREE);
  
    // Explicitly cast to boolean to satisfy TypeScript's type checking
    setIsFeatureUsable(!!canUseFeature);
  }, [currentUsage, user])

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

        // Avoid using raw model on start
        if (currentModel === null) {
          const domain = 'public'
          const author_name = 'thirdai';
          const model_name = 'GeneralQnA';
          try {
              const response = await axios.post(`http://localhost:${port}/use_model`, {
                  domain: domain,
                  model_name: model_name,
                  author_username: author_name
              })

              const data = response.data

              if (data.success) {
                  console.log(data.msg)

                  setCurrentModel({
                      author_name: author_name,
                      model_name: model_name
                  })
              } else {
                  console.error("Failed to set the model in the backend.")
              }
          } catch (error) {
              console.error('Error:', error)
          }
        }

        // Try to get the OpenAI key
        try {
          const response = await axios.get(`http://localhost:${port}/get_cached_openai_key`);
          const openAiKey = response.data.openai_key;

          setCachedOpenAIKey(openAiKey)
          console.log(`OpenAI cached key = ${openAiKey}`)
        } catch (error) {
          console.error('Error fetching OpenAI key:', error);
        }
      }
  
      window.electron.on('server-ready', handleServerReady)
    }
  }, [port])

  useEffect(() => {
      window.electron.on('update-available', () => {
          updateTrigger?.current?.click()
      })

      // Get current usage
      try {
        window.electron.invoke('get-current-usage').then(usageData => {
          console.log(`From Render: Current Usage: ${usageData.size} MB`)
          console.log(`From Render: Usage Reset Date: ${usageData.resetDate}`)

          // Update the state with the fetched usage data
          setCurrentUsage(usageData.size)

          // Here check if the limit is exceeded
          if (usageData.size > 200) {
            // Limit exceeded
            console.warn('Usage limit exceeded')
          }
        })
      } catch (error) {
        console.error('Error fetching current usage:', error);
      }
  }, [])

  return (
    <FeatureUsableContext.Provider value={{ isFeatureUsable }}>
    <SetAlertMessageProvider setAlertMessage={setAlertMessage}>

      <div className='full-page-setup p-0'>
      
          <AppUpdater trigger = {updateTrigger}/>
          <Subscribe trigger = {subscribeTrigger}
                    user = {user} 
                    setUser = {setUser}/>
          <SaveNotice trigger = {saveTrigger}
                      workSpaceMetadata={workSpaceMetadata} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                      setCurWorkSpaceID = {setCurWorkSpaceID}
                      afterSaveResetCurWorkspace = {afterSaveResetCurWorkspace}
                      allowUnsave = {allowUnsave}/>
          <Router>
            <Routes>

                <Route path="/ModelCards" element={<ModelCards  setCurWorkSpaceID = {setCurWorkSpaceID} setCurrentModel={setCurrentModel} 
                                                                progress = {modelDownloadProgress} setProgress = {setModelDownloadProgress}
                                                                startProgress = {startModelDownloadProgress} setStartProgress = {setStartModelDownloadProgress}
                                                                />} />
                
                <Route path="/" 
                element = {
                  <MainPage 
                            
                            selectedFiles={selectedFiles}
                            setSelectedFiles={setSelectedFiles}
                            progress={progress}
                            setProgress={setProgress}
                            startProgress={startProgress}
                            setStartProgress={setStartProgress}
                            currentModel={currentModel} 
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
                            setCurrentUsage = {setCurrentUsage}
                            cachedOpenAIKey = {cachedOpenAIKey}
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
                      user = {user} setUser = {setUser}
                      currentUsage = {currentUsage}
                      />
          </Router>
          <CustomAlertWrapper message={alertMessage} setMessage={setAlertMessage}/>
        {landing}
      </div>
    
    </SetAlertMessageProvider>
    </FeatureUsableContext.Provider>

  )
}

export default App
