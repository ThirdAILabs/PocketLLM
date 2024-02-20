import { useEffect, useState, useRef } from 'react';
import axios from 'axios'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import "bootstrap/dist/css/bootstrap.css";
import "bootstrap/dist/js/bootstrap.bundle.js";
import "bootstrap-icons/font/bootstrap-icons.css";

import { styled } from '@mui/material/styles'
import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import MenuIcon from '@mui/icons-material/Menu'

import SideBar from './components/SideBar'
import AppUpdater from "./components/AppUpdater"
import { usePort } from './contexts/PortContext'
import Subscribe from "./components/Subscribe"
import SaveNotice from './components/SaveNotice'
import { SetAlertMessageProvider } from './contexts/SetAlertMessageContext'
import CustomAlertWrapper from './components/CustomAlertWrapper'
import FilePage from './pages/FilePage'
import URLPage from './pages/URLPage'
import GmailPage from './pages/GmailPage'
import TitleBar from './components/TitleBar'
import WelcomePage from './pages/WelcomePage';

import './App.css'
import "./styling.css"

const drawerWidth = 275

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
  open?: boolean;
}>(({ theme, open }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: `-${drawerWidth}px`,
  ...(open && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginLeft: 0,
  }),
}))

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth}px`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}))

const MyToolbar = styled(Toolbar)(({ theme }) => ({
    ...theme.mixins.toolbar,
    backgroundColor: '#fff',
    border: "none",
    boxShadow: "none",
}))



export interface SearchResult {
  page_high: number
  page_low: number
  result_source: string
  result_text: string
  result_type: string
}

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
  gmailWorkspaceInfo?: GmailWorkspaceInfo; // Optional to maintain backward compatibility
}

export interface WorkSpaceFile {
  fileName: string;
  filePath: string;
  fileSize: number;
  uuid: string;
  isSaved: boolean;
}

export interface GmailWorkspaceInfo {
  email_account: string          // user gmail account
  last_email_date: string | null // lastest email's date into gmail.csv, null when no email in gmail.csv
  num_emails: number             // number of emails downloaded into gmail.csv, 0 when no email in gmail.csv
  is_downloading: boolean
  is_download_finished: boolean
  initial_download_num: number
  is_training: boolean
  is_training_finished: boolean
  is_sync: boolean
}

export enum SubscriptionPlan {
  FREE = "FREE",
  PREMIUM = "PREMIUM",
  SUPREME = "SUPREME"
}

export enum SummarizerType {
  OpenAI = "OpenAI",
  ThirdAI = "ThirdAI",
  // More types as needed
}

function App() {
  const { port } = usePort()

  const [open, setOpen] = useState(true)

  // Summarizer setting
  const [cachedOpenAIKey, setCachedOpenAIKey] = useState<string>('') // User cached OpenAI key
  const [summarizer, setSummarizer] = useState<SummarizerType | null>(null) // User summarizer choice

  // Workspace
  const [curWorkSpaceID, setCurWorkSpaceID] = useState<string|null>(null) //  Work Space ID: Used to keep track of current chosen workspace
  const [workSpaceMetadata, setWorkSpaceMetadata] = useState<WorkSpaceMetadata[]>([]) // All workspace

  // Trigger
  const updateTrigger = useRef<HTMLButtonElement>(null) // Update
  const subscribeTrigger = useRef<HTMLButtonElement>(null) // Subscription
  const [alertMessage, setAlertMessage] = useState<string>("") // Alert
  const saveTrigger = useRef<HTMLButtonElement>(null) // Save workspace notice

  // User
  const [user, setUser] = useState<{ email: string, name: string, subscription_plan: SubscriptionPlan  } | null>(null)

  // GmailPage uses this state to communicate to sidebar to sync
  const [gmailWorkspaceSyncID, setGmailWorkspaceSyncID] = useState<string|null>(null)

  // Load workspace and openai key info from disk
  useEffect(() => {
    if (port) {
      const loadStateVariable = async () => {
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
  
      window.electron.on('server-ready', loadStateVariable)
      window.electron.on('power-restarted', loadStateVariable)
    }
  }, [port])

  // Check for update
  useEffect(() => {
      window.electron.on('update-available', () => { updateTrigger?.current?.click() })
  }, [])

  // Debug print out all workspaces
  useEffect(() => {
    workSpaceMetadata.forEach(workspace => {
      console.log(`Workspace ID: ${workspace.workspaceID}`)
      // console.log(`Workspace Name: ${workspace.workspaceName}`)
      // console.log(`Model Author: ${workspace.model_info.author_name}`)
      // console.log(`Model Name: ${workspace.model_info.model_name}`)
      // workspace.documents.forEach(doc => {
      //   console.log(`Document Name: ${doc.fileName}`)
      //   console.log(`Document Path: ${doc.filePath}`)
      //   console.log(`Document UUID: ${doc.uuid}`)
      //   console.log(`Is Document Saved: ${doc.isSaved}`)
      // });
      // console.log(`Last Modified: ${workspace.last_modified}`)
      // console.log(`Is Workspace Saved: ${workspace.isWorkSpaceSaved}`)
      // console.log('----------------------------------------')
    });
  }, [workSpaceMetadata])

  return (
    <SetAlertMessageProvider setAlertMessage={setAlertMessage}>

      <div className='full-page-setup p-0'>
          <AppUpdater trigger = {updateTrigger}/>
          <Subscribe  trigger = {subscribeTrigger}
                      user = {user} setUser = {setUser}
                      setOpen = {setOpen}/>
          <SaveNotice trigger = {saveTrigger}
                      workSpaceMetadata={workSpaceMetadata} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                      setCurWorkSpaceID = {setCurWorkSpaceID}
          />


          <Box sx={{ display: 'flex' }}>
              <CssBaseline />
              
              <AppBar position="fixed" open={open} elevation={0}>
                  <MyToolbar>
                      <div className='d-flex text-secondary w-100'>
                          
                          <IconButton
                              color="inherit"
                              aria-label="open drawer"
                              onClick={()=>setOpen(true)}
                              edge="start"
                              sx={{my:2, ...(open && { display: 'none' }) }}
                              >
                              <MenuIcon/>
                          </IconButton>
                      
                          <TitleBar 
                                  workSpaceMetadata = {workSpaceMetadata} 
                                  saveWorkSpaceTrigger = {saveTrigger}
                          />
                      </div>
                  </MyToolbar>
              </AppBar>
              
              <BrowserRouter>
                    <SideBar
                      open = {open} setOpen = {setOpen}
                      summarizer = {summarizer} setSummarizer = {setSummarizer} cachedOpenAIKey = {cachedOpenAIKey} setCachedOpenAIKey = {setCachedOpenAIKey}
                      workSpaceMetadata = {workSpaceMetadata} 
                      subscribeTrigger={subscribeTrigger} 
                      curWorkSpaceID = {curWorkSpaceID} 
                      setCurWorkSpaceID = {setCurWorkSpaceID} 
                      setWorkSpaceMetadata = {setWorkSpaceMetadata} 
                      saveWorkSpaceTrigger = {saveTrigger}
                      user = {user} setUser = {setUser}
                      gmailWorkspaceSyncID = {gmailWorkspaceSyncID} setGmailWorkspaceSyncID = {setGmailWorkspaceSyncID}
                    />
                    
                    <Main open={open}>
                        <MyToolbar/>

                        <Routes>
                            <Route path='/' element={<WelcomePage/>} />
                            <Route path='/file/:id' element = {
                                <FilePage 
                                    summarizer = {summarizer}
                                    workSpaceMetadata={workSpaceMetadata} 
                                    curWorkSpaceID = {curWorkSpaceID} 
                                    setWorkSpaceMetadata = {setWorkSpaceMetadata}
                                />} 
                            />

                            <Route path='/url/:id' element={
                                <URLPage
                                    summarizer = {summarizer}
                                    workSpaceMetadata={workSpaceMetadata} 
                                    curWorkSpaceID = {curWorkSpaceID} 
                                    setWorkSpaceMetadata = {setWorkSpaceMetadata}
                                />
                            }/>

                            <Route path='/gmail/:id' element={
                                <GmailPage
                                      summarizer = {summarizer}
                                      workSpaceMetadata={workSpaceMetadata} 
                                      curWorkSpaceID = {curWorkSpaceID} 
                                      setWorkSpaceMetadata = {setWorkSpaceMetadata}
                                      setGmailWorkspaceSyncID = {setGmailWorkspaceSyncID}
                                  />
                            }/>
                        </Routes>
                    </Main>
              </BrowserRouter>
          </Box>
        <CustomAlertWrapper message={alertMessage} setMessage={setAlertMessage}/>
      </div>
    
    </SetAlertMessageProvider>
  )
}

export default App
