import { useState, useEffect } from 'react'

import { useParams } from 'react-router-dom'
import Tooltip from '@mui/material/Tooltip'
import SwitchPage from './SwitchPage'
import Teach from "../components/Teach"
import Summary from '../components/Summary'
import SearchBar from '../components/URLWorkSpace/SearchBar'
import Extraction from '../components/URLWorkSpace/Extraction'
import { WorkSpaceMetadata, SearchResult } from '../App'
import AddURLWorkspace from "../components/URLWorkSpace/AddURLWorkspace"
import EditableName from '../components/EditableName'
import ChatPage from './ChatPage'
import { SummarizerType } from '../App'

type urlPageProps = {
    summarizer: string | null,
    workSpaceMetadata: WorkSpaceMetadata[],
    curWorkSpaceID: string | null, setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>,
    setCurrentUsage: React.Dispatch<React.SetStateAction<number>>
}

export default function URLPage({
        summarizer,
        workSpaceMetadata, 
        curWorkSpaceID, setWorkSpaceMetadata,
        setCurrentUsage
    } : urlPageProps
    ){

    const { id } = useParams()

    const workspaceid = id?.substring(id?.indexOf(':')+1)
    const urlWorkspaceInfo = workSpaceMetadata.find(workspace => workspace.workspaceID === workspaceid)
    const documents = urlWorkspaceInfo ? urlWorkspaceInfo.documents : []

    const [summaryResult, setSummaryResult] = useState<string>('')
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])

    // Switching workspace clear out
    useEffect(()=>{
        setSummaryResult('')
        setSearchResults([])
    },[curWorkSpaceID])

    return (
        <div className='w-100 h-100 d-flex flex-column'>
            <SwitchPage
                searchContent ={
                <div className="w-100 h-100 my-2" style={{maxHeight: "95vh", overflowY: "auto"}}>
                    <div className='d-flex flex-column align-items-center'>

                        <EditableName   workspaceName = {urlWorkspaceInfo?.workspaceName || ''} 
                                        curWorkSpaceID = {curWorkSpaceID}  workSpaceMetadata = {workSpaceMetadata} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                            />

                        {/* display Context */}
                        <div className='d-flex justify-content-center align-items-center my-3'>
                            <div className='font-sm selected-file-list-wrapper w-100'>
                                <div className='font-x-sm mb-2'>Contexts</div>
                                <div className='selected-file-list-scrollbar-wrapper'>
                                    {documents.map(( {fileName, isSaved}, key) => (
                                        
                                        isSaved ?
                                        <div key={key}>
                                            {fileName}
                                        </div>
                                        :
                                        <div key={key} className='d-flex'>
                                            <div>{fileName}</div>
                                            <Tooltip title="Unsaved" placement='right'>
                                                <div className='ms-1' style={{cursor: "default"}}>*</div>
                                            </Tooltip>
                                        </div>
                                        
                                    ))}
                                </div>
                            </div>

                            <Tooltip title="Add URL" placement='right'>
                                <div className='btn btn-general ms-2' 
                                        data-bs-toggle="modal" 
                                        data-bs-target="#urlWorkspaceAdd">
                                    <i className="bi bi-folder-plus text-secondary fs-5"></i>
                                </div>

                            </Tooltip>

                            <AddURLWorkspace
                                curWorkSpaceID = {curWorkSpaceID}
                                setWorkSpaceMetadata = {setWorkSpaceMetadata} 
                                setCurrentUsage = {setCurrentUsage}
                            />
                        </div>

                        <div className='d-flex mb-3 align-items-center justify-content-center'>
                            <SearchBar setSearchResults = {setSearchResults} setSummaryResult = {setSummaryResult} summarizer={summarizer}/>
                            <Teach curWorkSpaceID = {curWorkSpaceID} setWorkSpaceMetadata = {setWorkSpaceMetadata}/>
                        </div>

                        <div style={{minWidth: "60vw", maxWidth: "70vw"}}>
                            <Summary summary = {summaryResult}/>
                            <Extraction searchResults={searchResults}
                                        curWorkSpaceID = {curWorkSpaceID} 
                                        setWorkSpaceMetadata = {setWorkSpaceMetadata}
                            />
                        </div>
                    </div>
                        
                </div>
                }
                isSummarizerOn = {summarizer === SummarizerType.OpenAI}
                chatContent={
                    <ChatPage curWorkSpaceID = {curWorkSpaceID}/>
                }
            />
                
        </div>
    )
  }
  