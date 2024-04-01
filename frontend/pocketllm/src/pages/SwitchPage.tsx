import { ReactNode } from 'react'
import { Tooltip } from '@mui/material'

type SwitchPageProps = {
    searchContent : ReactNode,
    chatContent: ReactNode,
    isSummarizerOn: boolean
}

export default function SwitchPage({searchContent, chatContent, isSummarizerOn} : SwitchPageProps) {
  return (
    <>
    <div className='d-flex justify-content-center mb-4 font-x-sm'>
                <ul className="nav nav-pills search-chat-switch" id="pills-tab" role="tablist">
                    <li className="nav-item" role="presentation">
                        <button className="nav-link active" id="pills-home-tab" data-bs-toggle="pill" data-bs-target="#pills-home" type="button" role="tab" aria-controls="pills-home" aria-selected="true">Search</button>
                    </li>
                    <Tooltip title={isSummarizerOn? "": "Turn on OpenAI switch to enable chat"} placement='top'>
                        <li className="nav-item" role="presentation">
                        <button className={`nav-link`} id="pills-profile-tab" data-bs-toggle="pill" data-bs-target="#pills-profile" type="button" role="tab" 
                                style={{opacity: `${ ! isSummarizerOn ? '0.5' : '1'}`}}
                                aria-controls="pills-profile" aria-selected="false"
                                disabled = {!isSummarizerOn}
                            >
                                Chat
                            </button>
                        </li>
                    </Tooltip>
                </ul>
    </div>
                <div className="tab-content" id="pills-tabContent">
        <div className="tab-pane fade show active" id="pills-home" role="tabpanel" aria-labelledby="pills-home-tab" tabIndex={0}>
            {searchContent}
        </div>
        <div className="tab-pane fade" id="pills-profile" role="tabpanel" aria-labelledby="pills-profile-tab" tabIndex={0}>
            {chatContent}
        </div>
    </div>
    </>
  )
}
