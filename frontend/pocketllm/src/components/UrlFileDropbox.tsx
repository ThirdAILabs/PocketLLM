import React, { useState, useEffect } from 'react'
import { Tooltip } from '@mui/material';

type FileDropProps = {
  setURLs : React.Dispatch<React.SetStateAction<string[]>>
}

export default function FileDropbox({setURLs} : FileDropProps) {
    const [draggover, setDraggover] = useState(false);

    useEffect(() => {
      const handler = (extractedUrls: string[]) => {
        setURLs(currentUrls => [...currentUrls, ...extractedUrls]);
      };
    
      const cleanup = window.electron.on('extracted-urls', handler);
    
      return () => {
        cleanup();
      };
    }, []);
    
    
    const onDrop = async (event: React.DragEvent<HTMLDivElement>) => {
        // Regular expression for URL validation
        const urlRegex = /https?:\/\/[^\s]+/g;

        // Function to validate and extract URLs from a string
        const extractUrls = (text: string): string[] => {
            const urls = text.match(urlRegex);
            return urls || [];
        };

        // Function to parse CSV content and extract URLs
        const parseCSVForURLs = (csvContent: string): string[] => {
            const lines = csvContent.split('\n');
            const urls = lines.flatMap(line => extractUrls(line));
            return urls;
        };

        event.preventDefault();
        setDraggover(false);
        const files = Array.from(event.dataTransfer.files);

        let allExtractedUrls: string[] = [];
        for (const file of files) {
            if (file.type === 'text/csv') {
                const text = await file.text();
                const extractedUrls = parseCSVForURLs(text);
                allExtractedUrls = allExtractedUrls.concat(extractedUrls);
            }
        }

        setURLs(currentUrls => [...currentUrls, ...allExtractedUrls]);
    };

    const selectFiles = () => {
        window.electron.send('open-csv-file-dialog')
    }

    function openLinkExternally(e: React.MouseEvent<HTMLAnchorElement>) {
        e.preventDefault();
        window.electron.openExternalUrl(e.currentTarget.href);
    }

  return (
    <div>
      <div className='d-flex justify-content-end align-items-end me-2 mb-1'>
          <Tooltip title="Download your Chrome Browsing History" placement='top'>
            <a className='font-x-sm' target='_blank' onClick={openLinkExternally} href='https://chrome.google.com/webstore/detail/export-chrome-history/dihloblpkeiddiaojbagoecedbfpifdj'>
              <i className="bi bi-browser-chrome font-sm"></i>  Click here to learn how to download your Chrome Browsing History as CSV?
            </a>
          </Tooltip>
        </div>
      <div className={`drop-zone-wrapper ${ draggover? " drop-zone-drag" : ""}`}>
        <div className='d-flex flex-column align-items-between'>
          <div onDrop={onDrop} onDragOver={(e) => {e.preventDefault(); setDraggover(true)}} 
              onDragLeave={(e) => {e.preventDefault(); setDraggover(false)}}
              className={`drop-zone drop-zone-innerwrapper`} 
              onClick={ selectFiles}>
              <i className="bi bi-upload fs-2 text-secondary mb-2"></i>
              <div className='text-secondary'> Drop or select .CSV files containing URLs</div>
          </div>
        </div>
      </div>
    </div>
    
    
  )
}
