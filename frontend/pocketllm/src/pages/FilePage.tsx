import { useEffect, useState } from 'react'

import { useParams } from 'react-router-dom'
import Tooltip from '@mui/material/Tooltip'
import SwitchPage from './SwitchPage'
import Teach from "../components/Teach"
import Summary from '../components/Summary'
import SearchBar from '../components/FileWorkSpace/SearchBar'
import Extraction from '../components/FileWorkSpace/Extraction'
import { WorkSpaceMetadata, SearchResult } from '../App'
import AddFileWorkspace from "../components/FileWorkSpace/AddFileWorkspace"
import EditableName from '../components/EditableName'
import ChatPage from './ChatPage'
import { SummarizerType } from '../App'

type filePageProps = {
    summarizer: string | null,
    workSpaceMetadata: WorkSpaceMetadata[],
    curWorkSpaceID: string | null, setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>,
    setCurrentUsage: React.Dispatch<React.SetStateAction<number>>
}

export default function FilePage({
        summarizer,
        workSpaceMetadata, 
        curWorkSpaceID, setWorkSpaceMetadata,
        setCurrentUsage
    } : filePageProps
    ){

    const { id } = useParams()

    const workspaceid = id?.substring(id?.indexOf(':')+1)
    const fileWorkspaceInfo = workSpaceMetadata.find(workspace => workspace.workspaceID === workspaceid)
    const documents = fileWorkspaceInfo ? fileWorkspaceInfo.documents : []

    const [summaryResult, setSummaryResult] = useState<string>('')
    const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)

    // Switching workspace clear out
    useEffect(()=>{
        setSummaryResult('')
        setSearchResults(null)
    },[curWorkSpaceID])

    return (
        <div className='w-100 h-100 d-flex flex-column'>
            <SwitchPage searchContent={
            <div className="w-100 h-100 my-2" style={{maxHeight: "70vh", overflowY: "auto"}}>
                <div className='d-flex flex-column align-items-center'>

                    <EditableName   workspaceName = {fileWorkspaceInfo?.workspaceName || ''} 
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
                        <Tooltip title="Add file" placement='right'>
                            <div className='btn btn-general ms-2' 
                                data-bs-toggle="modal" 
                                data-bs-target="#fileWorkspaceAdd">
                                    <i className="bi bi-folder-plus text-secondary fs-5"></i>
                            </div>
                        </Tooltip>
                        
                        <AddFileWorkspace
                            setCurrentUsage = {setCurrentUsage}
                            curWorkSpaceID = {curWorkSpaceID}
                            setWorkSpaceMetadata = {setWorkSpaceMetadata} 
                        />
                    </div>

                    <div className='d-flex mb-3 align-items-center justify-content-center'>    
                        <SearchBar setSearchResults = {setSearchResults} setSummaryResult = {setSummaryResult} summarizer={summarizer}/>
                        <Teach curWorkSpaceID = {curWorkSpaceID} setWorkSpaceMetadata = {setWorkSpaceMetadata}/>
                    </div>


                    <div style={{minWidth: "60vw"}}>
                        {
                            searchResults === null
                            ?
                            <></>
                            :
                            <>
                                {
                                    searchResults.length === 0 
                                    ?
                                    <div className='mt-5 text-secondary'>No results found</div>
                                    :
                                    <>
                                        <Summary summary = {summaryResult}/>
                                        <Extraction searchResults={searchResults}
                                                    curWorkSpaceID = {curWorkSpaceID} 
                                                    setWorkSpaceMetadata = {setWorkSpaceMetadata}
                                        />
                                    </>
                                }
                            </>
                        }
                    </div>
                </div>
            </div>
            }
                isSummarizerOn = {summarizer === SummarizerType.OpenAI}
                chatContent={<ChatPage curWorkSpaceID = {curWorkSpaceID}/>}
            />
            

                
        </div>
    )
  }
  