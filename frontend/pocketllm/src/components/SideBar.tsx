import React, { useState, useEffect, useRef, useContext } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

import { Modal } from 'bootstrap'
import { styled, useTheme } from '@mui/material/styles'
import { Tooltip } from '@mui/material'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

import { WorkSpaceMetadata, SubscriptionPlan, SummarizerType } from '../App'
import CreateFileWorkspace from './FileWorkSpace/CreateFileWorkspace'
import { usePort } from '../contexts/PortContext'
import SummarizerSwitch from './SummarizerSwitch'
import GeneralAccountProfile from './GeneralAccountProfile'
import SideBarItem from './SideBarItem'
import CreateURLWorkspace from './URLWorkSpace/CreateURLWorkspace'
import CreateGmailWorkspace from './GmailWorkSpace/CreateGmailWorkspace'
import Subscribe from './Subscribe'
import Settings from './Settings'
import GmailWorkspaceProgress from '../components/GmailWorkSpace/GmailWorkspaceProgress'
import { FeatureUsableContext } from '../contexts/FeatureUsableContext'

const drawerWidth = 290

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}))


type sideBarProps = {
    summarizer: SummarizerType | null, setSummarizer: React.Dispatch<React.SetStateAction<SummarizerType | null>>, cachedOpenAIKey: string, setCachedOpenAIKey: React.Dispatch<React.SetStateAction<string>>, summarizerWinOpen: boolean, setSummarizerWinOpen:  React.Dispatch<React.SetStateAction<boolean>>,

    workSpaceMetadata: WorkSpaceMetadata[],
    subscribeTrigger: React.RefObject<HTMLButtonElement>;
    saveWorkSpaceTrigger: React.RefObject<HTMLButtonElement>
    curWorkSpaceID: string | null
    setCurWorkSpaceID: (modelID: string | null) => void,
    setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>
    user : { email: string, name: string, subscription_plan: SubscriptionPlan  } | null,
    setUser: React.Dispatch<React.SetStateAction<{ email: string, name: string, subscription_plan: SubscriptionPlan  } | null>>,

    premiumEndDate: Date | null, setPremiumEndDate: React.Dispatch<React.SetStateAction<Date | null>>,
    currentUsage: number, setCurrentUsage: React.Dispatch<React.SetStateAction<number>>,


    open: boolean ,
    setOpen:  React.Dispatch<React.SetStateAction<boolean>>,
    gmailWorkspaceSyncID: string|null, setGmailWorkspaceSyncID:  React.Dispatch<React.SetStateAction<string|null>>
}


export default function SideBar(
    {   summarizer, setSummarizer, cachedOpenAIKey, setCachedOpenAIKey,
        workSpaceMetadata, curWorkSpaceID, setCurWorkSpaceID, setWorkSpaceMetadata, 
        subscribeTrigger, saveWorkSpaceTrigger,
        user, setUser, setPremiumEndDate, premiumEndDate, currentUsage, setCurrentUsage,
        open, setOpen,
        gmailWorkspaceSyncID, setGmailWorkspaceSyncID,
        summarizerWinOpen, setSummarizerWinOpen
    } : sideBarProps
){
    const navigate = useNavigate()

    const { port } = usePort()

    const theme = useTheme()

    const { isFeatureUsable } = useContext(FeatureUsableContext)

    const fileWorkspaceCreateModalRef = useRef(null)
    const URLWorkspaceCreateModalRef = useRef(null)
    const gmailWorkspaceCreateModalRef = useRef(null)
    const gmailWorkspaceProgressRef = useRef<HTMLButtonElement>(null)
    const gmailWorkspaceCloseRef = useRef<HTMLButtonElement>(null)

    const [gmailWorkspaceProgress, setGmailWorkspaceProgress] = useState(0)

    const handleClickLoadFileWorkspace = async (workspaceID: string) => {
        
        const isUnsavedWorkspaceExist = workSpaceMetadata.some(workspace => !workspace.isWorkSpaceSaved)

        if (isUnsavedWorkspaceExist) {
            // If there are unsaved workspaces, trigger the save button
            saveWorkSpaceTrigger.current?.click()

            return
        }

        try {
            const response = await axios.post(`http://localhost:${port}/load_by_id`, { workspaceID });
            
            if (response.data.success) {
                setCurWorkSpaceID(workspaceID)
                navigate(`/file/:${workspaceID}`)
                // console.log(`workspace ${workspaceID} loaded successfully`)
            } else {
                console.error("Failed to load workspace:", response.data.msg);
            }
        } catch (error) {
            console.error("Error loading workspace:", error);
        }
    }

    const handleClickLoadURLWorkspace = async (workspaceID: string) => {

        const isUnsavedWorkspaceExist = workSpaceMetadata.some(workspace => !workspace.isWorkSpaceSaved)

        if (isUnsavedWorkspaceExist) {
            // If there are unsaved workspaces, trigger the save button
            saveWorkSpaceTrigger.current?.click()

            return
        }

        try {
            const response = await axios.post(`http://localhost:${port}/load_by_id`, { workspaceID });
            
            if (response.data.success) {
                setCurWorkSpaceID(workspaceID)
                navigate(`/url/:${workspaceID}`)
                // console.log(`workspace ${workspaceID} loaded successfully`)
            } else {
                console.error("Failed to load workspace:", response.data.msg);
            }
        } catch (error) {
            console.error("Error loading workspace:", error);
        }
    }

    const updateWorkspaceMetaInfo = (workspaceID: string, updatedMetadata: WorkSpaceMetadata) => {
        setWorkSpaceMetadata(prevMetadata => {
            const index = prevMetadata.findIndex(ws => ws.workspaceID === workspaceID)
            if (index !== -1) {
                return [
                    ...prevMetadata.slice(0, index),
                    { ...updatedMetadata, isWorkSpaceSaved: true },
                    ...prevMetadata.slice(index + 1)
                ]
            } else {
                // If not found, just add the new metadata
                return [...prevMetadata, { ...updatedMetadata, isWorkSpaceSaved: true }]
            }
        })
    }

    const handleClickLoadGmailWorkspace = async (workspaceID: string) => {
        const isUnsavedWorkspaceExist = workSpaceMetadata.some(workspace => !workspace.isWorkSpaceSaved)

        if (isUnsavedWorkspaceExist) {
            // If there are unsaved workspaces, trigger the save button
            saveWorkSpaceTrigger.current?.click()

            return
        }

        // Function to determine the workspace state and take appropriate action
        async function checkAndHandleWorkspaceState(workspaceID: string) {
            try {
                const gmailWorkspace = workSpaceMetadata.find(workspace => workspace.workspaceID === workspaceID)
            
                if (gmailWorkspace?.gmailWorkspaceInfo?.is_training_finished) {
                    console.log("Load Workspace.")
                    const response = await axios.post(`http://localhost:${port}/load_gmail_workspace_by_id`, { workspaceID }) // If training is finished, load the workspace
                    if (response.data.success) {
                        setCurWorkSpaceID(workspaceID)
                        navigate(`/gmail/:${workspaceID}`)
                    } else {
                        console.error("Failed to load workspace:", response.data.msg)
                    }
                } else if (! gmailWorkspace?.gmailWorkspaceInfo?.is_download_finished) {
                    // If downloading is not finished, resume downloading
                    
                    console.log("Attempt to resume download...")
                    const ws = new WebSocket(`ws://localhost:${port}/gmail_resume_downloading`)
                    ws.onopen = () => { 
                        gmailWorkspaceProgressRef.current?.click()
                        ws.send(JSON.stringify({ 
                            workspaceid: workspaceID 
                        })) 
                    }
                    ws.onmessage = (event) => {
                        const data = JSON.parse(event.data)
                        console.log(data.progress, data.message)

                        setGmailWorkspaceProgress(data.progress)

                        if (data.complete) {
                            console.log(data.message)
                            
                            // Update metadata
                            const updatedMetadata: WorkSpaceMetadata = data.metadata
                            updateWorkspaceMetaInfo(workspaceID, updatedMetadata)

                            // Resume training
                            console.log("Attempt to resume training...")
                            const ws = new WebSocket(`ws://localhost:${port}/gmail_resume_training`)
                            ws.onopen = () => {
                                console.log("WebSocket connection established. Starting training.")
                                // gmailWorkspaceProgressRef.current?.click()
                                ws.send(JSON.stringify({
                                    workspaceid: workspaceID,
                                }))
                            }
                        
                            ws.onmessage = async (event) => {
                                // Handle messages from the server here
                                const messageData = JSON.parse(event.data)

                                setGmailWorkspaceProgress(messageData.progress)

                                if (messageData.complete) {
                                    console.log("Received message from server:", messageData.message)

                                    const updatedMetadata: WorkSpaceMetadata = messageData.metadata

                                    updateWorkspaceMetaInfo(workspaceID, updatedMetadata)
                                    gmailWorkspaceCloseRef.current?.click()

                                    const response = await axios.post(`http://localhost:${port}/load_gmail_workspace_by_id`, { workspaceID }) // After training is finished, load the workspace
                                    if (response.data.success) {
                                        setCurWorkSpaceID(workspaceID)
                                        navigate(`/gmail/:${workspaceID}`)
                                    } else {
                                        console.error("Failed to load workspace:", response.data.msg)
                                    }
                                }
                            }
                        }
                    }

                } else {
                    // Resume training
                    console.log("Attempt to resume training...")
                    const ws = new WebSocket(`ws://localhost:${port}/gmail_resume_training`)
                    ws.onopen = () => {
                        console.log("WebSocket connection established. Starting training.")
                        gmailWorkspaceProgressRef.current?.click()
                        ws.send(JSON.stringify({
                            workspaceid: workspaceID,
                        }))
                    }
                
                    ws.onmessage = async (event) => {
                        // Handle messages from the server here
                        const messageData = JSON.parse(event.data)

                        setGmailWorkspaceProgress(messageData.progress)

                        if (messageData.complete) {
                            console.log("Received message from server:", messageData.message)

                            const updatedMetadata: WorkSpaceMetadata = messageData.metadata

                            updateWorkspaceMetaInfo(workspaceID, updatedMetadata)
                            gmailWorkspaceCloseRef.current?.click()

                            const response = await axios.post(`http://localhost:${port}/load_gmail_workspace_by_id`, { workspaceID }) // After training is finished, load the workspace
                            if (response.data.success) {
                                setCurWorkSpaceID(workspaceID)
                                navigate(`/gmail/:${workspaceID}`)
                            } else {
                                console.error("Failed to load workspace:", response.data.msg)
                            }

                        }
                    }
                }
            } catch (error) {
                console.error("Failed to handle workspace state:", error);
            }
        }

        await checkAndHandleWorkspaceState(workspaceID)
    }

    const handleClickCreateFileWorkspace = async () => {
        const showBootstrapModal = () => {
            if (fileWorkspaceCreateModalRef.current) {
              const modalElement = fileWorkspaceCreateModalRef.current;
              const bsModal = new Modal(modalElement, {
                keyboard: false // Optional: specify modal options
              })
              bsModal.show()
            }
        }

        if ( curWorkSpaceID != null) {
            const curWorkSpace = workSpaceMetadata.find(workspace => workspace.workspaceID === curWorkSpaceID)

            if ( ! curWorkSpace?.isWorkSpaceSaved) { // if current workspace is not saved
                saveWorkSpaceTrigger.current?.click()
                return
            }
        }

        showBootstrapModal()
    }

    const handleClickCreateURLWorkspace = async () => {
        const showBootstrapModal = () => {
            if (URLWorkspaceCreateModalRef.current) {
              const modalElement = URLWorkspaceCreateModalRef.current;
              const bsModal = new Modal(modalElement, {
                keyboard: false // Optional: specify modal options
              })
              bsModal.show()
            }
        }

        if ( curWorkSpaceID != null) {
            const curWorkSpace = workSpaceMetadata.find(workspace => workspace.workspaceID === curWorkSpaceID)

            if ( ! curWorkSpace?.isWorkSpaceSaved) { // if current workspace is not saved
                saveWorkSpaceTrigger.current?.click()
                return
            }
        }

        showBootstrapModal()
    }

    const handleClickCreateGmailWorkspace = async () => {
        const showBootstrapModal = () => {
            if (gmailWorkspaceCreateModalRef.current) {
              const modalElement = gmailWorkspaceCreateModalRef.current;
              const bsModal = new Modal(modalElement, {
                keyboard: false // Optional: specify modal options
              })
              bsModal.show()
            }
        }

        if ( curWorkSpaceID != null) {
            const curWorkSpace = workSpaceMetadata.find(workspace => workspace.workspaceID === curWorkSpaceID)

            if ( ! curWorkSpace?.isWorkSpaceSaved) { // if current workspace is not saved
                saveWorkSpaceTrigger.current?.click()
                return
            }
        }

        showBootstrapModal()
    }

    const handleDeleteWorkSpace = async (workspaceID: string) => {
        // console.log("Attempting to delete workspace with ID:", workspaceID)

        if (curWorkSpaceID === workspaceID) { // if to delete the workspace current loading, reset backend
            try {
                const response = await axios.post(`http://localhost:${port}/reset_neural_db`)

                if (response.data.success) {
                    setCurWorkSpaceID(null)
                }
            } catch (error) {
                console.error("Error during backend reset:", error)
            }
        }

        const workspace = workSpaceMetadata.find(ws => ws.workspaceID === workspaceID)

        if (! workspace) {
            console.error("Workspace not found:", workspaceID)
            return
        }

        if ( ! workspace.isWorkSpaceSaved ) { // If the workspace is not saved: completely new or has some modified change
            const unsavedWorkspace = workspace

            const hasSavedFiles = unsavedWorkspace.documents.some(doc => doc.isSaved)

            if (hasSavedFiles) {
                console.log('removing unsaved files and mark workspace as saved')

                const savedDocs = unsavedWorkspace.documents.filter(doc => doc.isSaved)
                const updatedWorkSpaceMetadata = workSpaceMetadata.map(
                    workspace => 
                        workspace.workspaceID === unsavedWorkspace.workspaceID
                        ? { ...workspace, documents: savedDocs, isWorkSpaceSaved: true }
                        : workspace
                )
                setWorkSpaceMetadata(updatedWorkSpaceMetadata)
            } else {
                console.log('Delete new workspace by remove entire workspace metadata')

                const updatedWorkSpaceMetadata = workSpaceMetadata.filter(workspace => workspace.workspaceID !== unsavedWorkspace.workspaceID)
                setWorkSpaceMetadata(updatedWorkSpaceMetadata)
            }

        } else { // Delete an existing saved & unmodified workspace
            try {
                const response = await axios.post(`http://localhost:${port}/delete_by_id`, { workspaceID })
        
                if (response.data.success) {
                    console.log("Workspace deleted successfully")
    
                    // Remove the workspace with the given workspaceID
                    setWorkSpaceMetadata(prevMetadata => prevMetadata.filter(md => md.workspaceID !== workspaceID))
                } else {
                    console.error("Failed to delete workspace:", response.data.msg)
                }
            } catch (error) {
                console.error("Error during workspace deletion:", error)
            }
        }
    }

    const handleExportWorkSpace = (workspaceID: string) => {
        const workspace = workSpaceMetadata.find(ws => ws.workspaceID === workspaceID)

        if ( !workspace ) {
            console.error("Workspace not found:", workspaceID)
            return
        }

        // workspace never saved or it's saved and modified
        const isWorkspaceUnsaved = !workspace.isWorkSpaceSaved

        // Invoke Electron's save dialog
        window.electron.invoke('show-save-dialog').then(filePath => {
            if (!filePath) {
                // console.log('Export dialog was canceled')
                return
            }
            // console.log('Workspace will be exported to:', filePath)
    
            // Prepare export data based on the workspace state
            const exportData = isWorkspaceUnsaved ? 
                { filePath, workspaceID, workspaceName: workspace.workspaceName, currentModel: workspace.model_info } :
                { filePath, workspaceID }
    
            // Select endpoint based on the workspace state
            const endpoint = isWorkspaceUnsaved ? '/export_new_workspace' : '/export_by_id'
    
            axios.post(`http://localhost:${port}${endpoint}`, exportData)
                .then(_ => {
                    // console.log('Workspace exported successfully:', response.data)
                })
                .catch(error => {
                    console.error('Error during model export:', error)
                })
        })
        .catch(err => {
            console.error('Error showing save dialog', err)
        })
    }

    const handleImportWorkSpace = () => {
        window.electron.send('open-folder-dialog')

        window.electron.once('selected-folder', (directoryPath: string) => {
            console.log('Directory chosen:', directoryPath)
            
            axios.post(`http://localhost:${port}/import_workspace`, { directoryPath })
            .then(response => {
                console.log('Workspace imported successfully:', response.data)

                const importedMetadata = {
                    ...response.data.metadata,
                    isWorkSpaceSaved: true // Set the isWorkSpaceSaved to true
                }

                setWorkSpaceMetadata(prevMetadata => [...prevMetadata, importedMetadata])
            })
            .catch(error => {
                console.error('Error during workspace import:', error);
            });
        })
    }
    

    const [fileWorkSpaces, setFileWorkSpaces] = useState<WorkSpaceMetadata[]>([]);
    const [urlWorkSpaces, setUrlWorkSpaces] = useState<WorkSpaceMetadata[]>([])
    const [gmailWorkSpaces, setGmailWorkSpaces] = useState<WorkSpaceMetadata[]>([])

    // Partition workspaces into File and URL
    useEffect(() => {
        const partitionWorkSpaces = () => {
            const fileWS: WorkSpaceMetadata[] = []
            const urlWS: WorkSpaceMetadata[] = []
            const gmailWS: WorkSpaceMetadata[] = []

            workSpaceMetadata.forEach(workspace => {
                if (workspace.gmailWorkspaceInfo) {
                    // If the workspace has GmailWorkspaceInfo, add to gmailWS
                    gmailWS.push(workspace)
                } else {
                    // Check if all documents in the workspace are files
                    const isFile = (fileName: string) => {
                        const fileExtensions = ['.pdf', '.csv', '.docx']
                        return fileExtensions.some(ext => fileName.toLowerCase().endsWith(ext))
                    }
                    const allFiles = workspace.documents.every(doc => isFile(doc.fileName))

                    if (allFiles) {
                        // If all documents are files, add to fileWS
                        fileWS.push(workspace)
                    } else {
                        // Otherwise, add to urlWS
                        urlWS.push(workspace)
                    }
                }
            })

            setFileWorkSpaces(fileWS)
            setUrlWorkSpaces(urlWS)
            setGmailWorkSpaces(gmailWS)
        }

        partitionWorkSpaces()
    }, [workSpaceMetadata])


    // When not loading workspace, go to home page
    useEffect(()=>{
        if(curWorkSpaceID == null)
            navigate('/')
    },[curWorkSpaceID])


    useEffect( ()=>{
        const syncGmailWorkspace = async () => {
            if (gmailWorkspaceSyncID) {
                try {
                    const response = await axios.post(`http://localhost:${port}/gmail_sync`, { workspaceID: gmailWorkspaceSyncID })
                    
                    if (response.data.success) {
                        console.log('Synced this gmail workspace:', gmailWorkspaceSyncID)
                        navigate('/') // Go to homepage
                        setCurWorkSpaceID(null)
                        
                        console.log("Attempt to resume download...")
                        const ws = new WebSocket(`ws://localhost:${port}/gmail_resume_downloading`)
                        ws.onopen = () => { 
                            gmailWorkspaceProgressRef.current?.click()
                            ws.send(JSON.stringify({ 
                                workspaceid: gmailWorkspaceSyncID 
                            })) 
                        }
                        ws.onmessage = (event) => {
                            const data = JSON.parse(event.data)
                            console.log(data.progress, data.message)
    
                            setGmailWorkspaceProgress(data.progress)
    
                            if (data.complete) {
                                console.log(data.message)
                                
                                // Update metadata
                                const updatedMetadata: WorkSpaceMetadata = data.metadata
                                updateWorkspaceMetaInfo(gmailWorkspaceSyncID, updatedMetadata)
    
                                // Resume training
                                console.log("Attempt to resume training...")
                                const ws = new WebSocket(`ws://localhost:${port}/gmail_resume_training`)
                                ws.onopen = () => {
                                    console.log("WebSocket connection established. Starting training.")
                                    // gmailWorkspaceProgressRef.current?.click()
                                    ws.send(JSON.stringify({
                                        workspaceid: gmailWorkspaceSyncID,
                                    }))
                                }
                            
                                ws.onmessage = async (event) => {
                                    // Handle messages from the server here
                                    const messageData = JSON.parse(event.data)
    
                                    // setGmailWorkspaceProgress(messageData.progress)
    
                                    if (messageData.complete) {
                                        console.log("Received message from server:", messageData.message)
    
                                        const updatedMetadata: WorkSpaceMetadata = messageData.metadata
    
                                        updateWorkspaceMetaInfo(gmailWorkspaceSyncID, updatedMetadata)
                                        
                                        setTimeout(() => {
                                            gmailWorkspaceCloseRef.current?.click()
                                        }, 2000)
    
                                        const response = await axios.post(`http://localhost:${port}/load_gmail_workspace_by_id`, { workspaceID: gmailWorkspaceSyncID }) // After training is finished, load the workspace
                                        if (response.data.success) {
                                            setCurWorkSpaceID(gmailWorkspaceSyncID)
                                            navigate(`/gmail/:${gmailWorkspaceSyncID}`)
                                        } else {
                                            console.error("Failed to load workspace:", response.data.msg)
                                        }
                                    }
                                }
                            }
                        }

                    } else {
                        console.error("Failed to sync workspace:", response.data.message || 'Unknown error')
                    }
                } catch (error) {
                    console.error("Failed to sync workspace due to an error")
                } finally {
                    setGmailWorkspaceSyncID(null) // After sync finished, set sync id to null
                }
            }
        }
            
        syncGmailWorkspace()
    },[gmailWorkspaceSyncID])

    return (
        <>
            <Drawer
                PaperProps={{
                    sx: {
                    backgroundColor: "rgb(247, 247, 247)",
                    }
                }}
                sx={{
                width: drawerWidth,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                    width: drawerWidth,
                    border: "none",
                    boxSizing: 'border-box',
                },
                }}
                variant="persistent"
                anchor="left"
                open={open}
            >
                <DrawerHeader>
                    <IconButton 
                        onClick={()=>setOpen(false)}>
                        {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                    </IconButton>
                </DrawerHeader>
                <div className='w-100 h-100 d-flex flex-column justify-content-between'>
                    <div className="font-sm w-100">
                        <div className='px-2 mb-1'>
                            <button  type="button"  
                                     className='font-sm text-start btn btn-general2 bg-transparent rounded-3 py-2 w-100 d-flex align-items-center'
                                     onClick={handleImportWorkSpace}
                                     >
                                    <i className="bi bi-cloud-arrow-up text-secondary me-3 fs-5"></i>
                                    <div>Import Workspace</div>
                            </button>
                        </div>
                        <SideBarItem    collapseId = {"CollapseFile"} 
                                        logo = {"📃"} 
                                        workspaceName = "File"
                                        createButtonComponent = {
                                            isFeatureUsable
                                            ?
                                            <Tooltip title="New workspace" placement='right'>
                                                    <i  className="bi bi-plus-lg btn btn-general p-0 px-1"           
                                                            onClick={handleClickCreateFileWorkspace}
                                                    />
                                            </Tooltip>
                                            :
                                            <Tooltip title="Please subscribe for more workspace" placement='right'>
                                                <i className="bi bi-plus-lg p-0 px-1 text-body-tertiary btn"/>
                                            </Tooltip>
                                        }
                                        CreateWorkspaceComponent  = { 
                                            <CreateFileWorkspace
                                                setCurWorkSpaceID = {setCurWorkSpaceID}
                                                setWorkSpaceMetadata = {setWorkSpaceMetadata}
                                                modalRef={fileWorkspaceCreateModalRef}
                                                setCurrentUsage = {setCurrentUsage}
                                            />
                                        }
                                        workspaces = {fileWorkSpaces} curWorkSpaceID = {curWorkSpaceID}
                                        handleClickLoadWorkspace = {handleClickLoadFileWorkspace}
                                        handleClickExportWorkSpace = {handleExportWorkSpace}
                                        handleClickDeleteWorkspace = {handleDeleteWorkSpace}
                        />

                        <SideBarItem    collapseId = {"CollapseGmail"}
                                        logo = {"📧"} 
                                        workspaceName = "Gmail"
                                        createButtonComponent = {
                                            isFeatureUsable
                                            ?
                                            <Tooltip title="New workspace" placement='right'>
                                                    <i  className="bi bi-plus-lg btn btn-general p-0 px-1"
                                                        onClick={handleClickCreateGmailWorkspace}/>
                                            </Tooltip>
                                            :
                                            <Tooltip title="Please subscribe for more workspace" placement='right'>
                                                <i className="bi bi-plus-lg p-0 px-1 text-body-tertiary btn"/>
                                            </Tooltip>
                                        }
                                        CreateWorkspaceComponent  = { 
                                            <CreateGmailWorkspace
                                                setCurWorkSpaceID = {setCurWorkSpaceID}
                                                setWorkSpaceMetadata = {setWorkSpaceMetadata}
                                                modalRef={gmailWorkspaceCreateModalRef}
                                                gmailWorkspaceProgressRef={gmailWorkspaceProgressRef} gmailWorkspaceCloseRef = {gmailWorkspaceCloseRef}
                                                setGmailWorkspaceProgress={setGmailWorkspaceProgress}
                                                setCurrentUsage = {setCurrentUsage}
                                            />
                                        }
                                        workspaces = {gmailWorkSpaces} curWorkSpaceID = {curWorkSpaceID}
                                        handleClickLoadWorkspace = {handleClickLoadGmailWorkspace}
                                        handleClickExportWorkSpace = {handleExportWorkSpace}
                                        handleClickDeleteWorkspace = {handleDeleteWorkSpace}
                        
                        />
                        <SideBarItem    collapseId = {"CollapseBrowser"} 
                                        logo = {"🔗"} 
                                        workspaceName = "Browser"
                                        createButtonComponent = {
                                            isFeatureUsable
                                            ?
                                            <Tooltip title="New workspace" placement='right'>
                                                    <i  className="bi bi-plus-lg btn btn-general p-0 px-1"
                                                        onClick={handleClickCreateURLWorkspace}/>
                                            </Tooltip>
                                            :
                                            <Tooltip title="Please subscribe for more workspace" placement='right'>
                                                <i className="bi bi-plus-lg p-0 px-1 text-body-tertiary btn"/>
                                            </Tooltip>
                                        }
                                        CreateWorkspaceComponent  = { 
                                            <CreateURLWorkspace
                                                setCurWorkSpaceID = {setCurWorkSpaceID}
                                                setWorkSpaceMetadata = {setWorkSpaceMetadata}
                                                modalRef={URLWorkspaceCreateModalRef}
                                                setCurrentUsage = {setCurrentUsage}
                                            />
                                        }
                                        workspaces = {urlWorkSpaces} curWorkSpaceID = {curWorkSpaceID}
                                        handleClickLoadWorkspace = {handleClickLoadURLWorkspace}
                                        handleClickExportWorkSpace = {handleExportWorkSpace}
                                        handleClickDeleteWorkspace = {handleDeleteWorkSpace}
                        />

                    </div>
                    <div className='rounded-0 py-3 border-0 border-shadow w-100'>
                        <SummarizerSwitch summarizer = {summarizer} setSummarizer = {setSummarizer} cachedOpenAIKey = {cachedOpenAIKey} setCachedOpenAIKey = {setCachedOpenAIKey} open = {summarizerWinOpen} setOpen = {setSummarizerWinOpen} />
                        <Subscribe trigger = {subscribeTrigger} user={user} setUser={setUser} setOpen = {setOpen}/>
                        <Settings trigger = {subscribeTrigger} user={user} setPremiumEndDate = {setPremiumEndDate} premiumEndDate = {premiumEndDate} currentUsage={currentUsage}/>
                        <GeneralAccountProfile user={user} setUser = {setUser}/>
                    </div>
                </div>

                <GmailWorkspaceProgress progress = {gmailWorkspaceProgress} 
                                    gmailWorkspaceProgressRef = {gmailWorkspaceProgressRef} gmailWorkspaceCloseRef = {gmailWorkspaceCloseRef}
                                    setCurWorkSpaceID = {setCurWorkSpaceID}
                                    />
            </Drawer>
        </>
    );
    }