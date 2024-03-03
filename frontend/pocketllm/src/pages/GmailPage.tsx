import { useEffect, useState } from 'react'

import { useParams } from 'react-router-dom'
import Tooltip from '@mui/material/Tooltip'
import { parseISO, differenceInMinutes, differenceInHours, formatDistanceToNow } from 'date-fns'

import Teach from "../components/Teach"
import Summary from '../components/Summary'
import SearchBar from '../components/GmailWorkSpace/SearchBar'
import Extraction from '../components/GmailWorkSpace/Extraction'
import { WorkSpaceMetadata, SearchResult } from '../App'
import EditableName from '../components/EditableName'
import useTelemetry from '../hooks/useTelemetry'

type gmailPageProps = {
    summarizer: string | null, setSummarizerWinOpen:  React.Dispatch<React.SetStateAction<boolean>>,
    workSpaceMetadata: WorkSpaceMetadata[],
    curWorkSpaceID: string | null, setWorkSpaceMetadata: React.Dispatch<React.SetStateAction<WorkSpaceMetadata[]>>,
    setGmailWorkspaceSyncID:  React.Dispatch<React.SetStateAction<string|null>>,
    setCurrentUsage: React.Dispatch<React.SetStateAction<number>>
}

const formatDate = (dateIsoString: string): string => {
  if (!dateIsoString) {
    return 'Date not available'; // or handle as appropriate
  }

  const date = parseISO(dateIsoString);
  const now = new Date();

  const minutesDiff = differenceInMinutes(now, date);
  
  if (minutesDiff < 60) {
    // If the difference is less than 60 minutes, show in minutes
    return `${minutesDiff} minute(s) ago`;
  }

  const hoursDiff = differenceInHours(now, date);
  if (hoursDiff < 24) {
    // If the difference is less than 24 hours, show in hours
    return `${hoursDiff} hour(s) ago`;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);

  if (date >= today) {
    return 'Today';
  } else if (date >= yesterday) {
    return 'Yesterday';
  } else if (date >= lastWeek) {
    return `${formatDistanceToNow(date)} ago`; // e.g., "3 days ago"
  } else {
    // Modify here to format the date as "Feb 2, 2024"
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }
}

export default function GmailPage({
        summarizer, setSummarizerWinOpen,
        workSpaceMetadata, 
        curWorkSpaceID, setWorkSpaceMetadata,
        setGmailWorkspaceSyncID,
        setCurrentUsage
    } : gmailPageProps
    ){

    const { id } = useParams()

  const recordEvent = useTelemetry()

    const workspaceid = id?.substring(id?.indexOf(':')+1)
    const gmailWorkspaceInfo = workSpaceMetadata.find(workspace => workspace.workspaceID === workspaceid)
    const last_email_date = gmailWorkspaceInfo?.gmailWorkspaceInfo?.last_email_date
    const num_emails = gmailWorkspaceInfo?.gmailWorkspaceInfo?.num_emails
    const email_account = gmailWorkspaceInfo?.gmailWorkspaceInfo?.email_account

    const [summaryResult, setSummaryResult] = useState<string>('')
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])

    // Switching workspace clear out
    useEffect(()=>{
        setSummaryResult('')
        setSearchResults([])
    },[curWorkSpaceID])

    return (
        <div className='w-100 h-100 d-flex flex-column justify-content-between'>
                <div className="w-100 h-100 mt-5 mb-2" style={{maxHeight: "70vh", overflowY: "auto"}}>
                    <div className='d-flex flex-column align-items-center'>

                        <EditableName   workspaceName = {gmailWorkspaceInfo?.workspaceName || ''} 
                                        curWorkSpaceID = {curWorkSpaceID}  workSpaceMetadata = {workSpaceMetadata} setWorkSpaceMetadata = {setWorkSpaceMetadata}
                            />

                        <div className='d-flex justify-content-center align-items-center my-3'>
                            {/* display Context */} 
                            <div className='my-3 text-secondary font-sm' style={{marginRight: '20px'}}>
                                <div>
                                  {`${num_emails} emails | Last email date: ${formatDate(last_email_date!)}`}
                                </div>
                                <div>
                                  {`${email_account}`}
                                </div>
                                
                            </div>

                            <Tooltip title="Sync inbox" placement='right' style={{cursor: 'pointer'}}>
                                <i className="bi bi-arrow-repeat fs-5" onClick={()=>{
                                    setGmailWorkspaceSyncID(workspaceid ?? null)
                                    setCurrentUsage(prevUsage => prevUsage + 2)

                                    recordEvent({
                                      UserAction: `Sync gmail inbox`,
                                      UIComponent: 'Gmail sync button',
                                      UI: 'GmailPage',
                                  })
                                }}/>
                            </Tooltip>
                            
                        </div>

                        <div className='d-flex mb-3 align-items-center justify-content-center'>    
                            <SearchBar setSearchResults = {setSearchResults} setSummaryResult = {setSummaryResult} summarizer={summarizer}/>
                            <Teach curWorkSpaceID = {curWorkSpaceID} setWorkSpaceMetadata = {setWorkSpaceMetadata}/>
                        </div>

                        <div style={{width: '60vw', padding: '20px'}}>
                            <Summary summary = {summaryResult}/>
                            <Extraction searchResults={searchResults}
                                        curWorkSpaceID = {curWorkSpaceID} 
                                        setWorkSpaceMetadata = {setWorkSpaceMetadata}
                                        setSummarizerWinOpen = {setSummarizerWinOpen}
                            />
                        </div>
                    </div>
                        
                </div>
        </div>
    )
  }
  