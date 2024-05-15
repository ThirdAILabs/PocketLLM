import { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios'
import { debounce } from 'lodash'

import "bootstrap-icons/font/bootstrap-icons.css";

// import AppUpdater from "./components/AppUpdater"
// import Subscribe from "./components/Subscribe"
import { usePort } from './contexts/PortContext'
// import { SetAlertMessageProvider } from './contexts/SetAlertMessageContext'
// import { FeatureUsableContext } from './contexts/FeatureUsableContext'

import CircularWithValueLabel from './components/ProgressCircleSpotlight';

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css'; // Import TextLayer CSS

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface LoadSuccessParams {
  numPages: number;
}


import './App.css'
import "./styling.css"
import "./spotlightSearch.css"


export interface SearchResult {
  page_high: number
  page_low: number
  result_source: string
  result_text: string
  result_type: string
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

  // // Summarizer setting
  // const [cachedOpenAIKey, setCachedOpenAIKey] = useState<string>('') // User cached OpenAI key
  // const [summarizer, setSummarizer] = useState<SummarizerType | null>(null) // User summarizer choice
  // const [summarizerWinOpen, setSummarizerWinOpen] = useState(false)

  // Trigger
  const updateTrigger = useRef<HTMLButtonElement>(null) // Update
  // const subscribeTrigger = useRef<HTMLButtonElement>(null) // Subscription
  // const [alertMessage, setAlertMessage] = useState<string>("") // Alert
  // const saveTrigger = useRef<HTMLButtonElement>(null) // Save workspace notice

  // User
  const [user, ] = useState<{ email: string, name: string, subscription_plan: SubscriptionPlan  } | null>(null)
  const [currentUsage, setCurrentUsage] = useState(0)
  const [premiumEndDate, setPremiumEndDate] = useState<Date | null>(null)
  const [_, setIsFeatureUsable] = useState(true)

  // Track if backend has started
  // const [isBackendStarted, setIsBackendStarted] = useState<boolean>(false)
  const [isBackendStarted, setIsBackendStarted] = useState<boolean>(true)

  // Global workspace
  const [globalSearchStr, setGlobalSearchStr] = useState('') // Global workspace search string
  // const [globalWorkspaceReady, setGlobalWorkspaceReady] = useState(false) // Status of global workspace
  const [globalWorkspaceReady, setGlobalWorkspaceReady] = useState(true) // Status of global workspace
  const [globalSearchResults, setGlobalSearchResults] = useState<SearchResult[] | null>(null)
  const [, setStartGlobalProgress] = useState(false)
  const [globalIndexProgress, setGlobalIndexProgress] = useState(0)
  const [keywords, setKeywords] = useState<string[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)

  const stopWords = new Set(['the', 'a', 'an', 'and', 'but', 'or', 'on', 'in', 'with', 'any', 'is', 'to', 'of', 'as', 'at', 'for'])

  function extractKeywords(text: string) {
    return text.toLowerCase().split(/\s+/).filter(word => !stopWords.has(word) && word.length > 0)
  }

  function highlightText(text: string, keywords: string[]) {
    function escapeRegExp(string: string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special characters for regex
    }
    const escapedKeywords = keywords.map(keyword => escapeRegExp(keyword)); // Escape keywords
    const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'gi'); // Create a regex from keywords, case-insensitive
    const parts = text.split(regex) // Split text into parts, capturing the keywords

    return parts.map((part, index) => {
        if (keywords.includes(part.toLowerCase())) { // Check if the part is a keyword
            return <span key={index} style={{ backgroundColor: 'yellow' }}>{part}</span>
        }
        return part // Non-keyword parts are returned as normal text
    })
  }

  useEffect(() => {
    const words = extractKeywords(globalSearchStr)
    setKeywords(words)
  }, [globalSearchStr])

  const handleSearchGlobalWorkspace = async (searchStr: string) => {
    if( port ) {
      if (searchStr.trim()) {
        try {
            const response = await axios.post<SearchResult[]>(`http://localhost:${port}/query`, { search_str: searchStr });
            
            setGlobalSearchResults(response.data.slice(0, 3))
            console.log(response.data.slice(0, 3))
        } catch (error) {
            console.error('Error querying backend:', error);
        }
      } else {
        setGlobalSearchResults(null)
      }
    }
  }

  // Debounce the search function
  const debouncedSearch = useCallback(debounce(handleSearchGlobalWorkspace, 50), [port]);

  // Load workspace and openai key info from disk
  useEffect(() => {
    if (port) {
      // Index global workspace
      const indexGlobalWorkspace = () => {
        try {
          const ws = new WebSocket(`ws://localhost:${port}/index_pdf_os`);
    
          ws.onopen = () => {
              console.log('WebSocket Client Connected to /index_pdf_os');
              setStartGlobalProgress(true)
              ws.send(JSON.stringify({})); // Send an empty JSON object to trigger the server-side indexing
          };
    
          ws.onmessage = (message) => {
              const data = JSON.parse(message.data)
              console.log(data.progress, data.message)

              if (data.message === 'No data found for training.') {
                  setStartGlobalProgress(false)
              }

              setGlobalIndexProgress(data.progress)
              console.log(data.progress)
    
              if (data.complete) {
                  console.log('Indexing Completed!');
                  setGlobalWorkspaceReady(true)

                  setTimeout(() => {
                    setGlobalIndexProgress(0)
                    setStartGlobalProgress(false)
                  }, 500)
              }
          };
    
          ws.onerror = (error) => {
              console.error(`WebSocket Error: ${error}`);
          };
    
          ws.onclose = () => {
              console.log('WebSocket connection closed');
              setStartGlobalProgress(false)
          };
        } catch (error) {
            console.error('Error:', error);
            setStartGlobalProgress(false)
        }
      }

      // Try to save or load spotlight search
      const checkLoadGlobalWorkspace = async () => {
        try {
          const response = await axios.get(`http://localhost:${port}/check_load_global_workspace/`)
          console.log('Response:', response.data)
          
          // update state to show global workspace loaded successfully
          setGlobalWorkspaceReady(true)
          // update state bcz backend definitely started. 
          // sometimes after power off, react state is set to false but backend still running.
          setIsBackendStarted(true)
        } catch (error) {
          console.error('Error loading workspace:', error)

          // start indexing global workspace
          indexGlobalWorkspace()
        }
      }

      window.electron.on('server-ready', checkLoadGlobalWorkspace)
      window.electron.on('power-restarted', checkLoadGlobalWorkspace)
    }
  }, [port])

  // Make sure search bar is focused and ready to search, esp on application start
  useEffect(()=>{
    if (globalWorkspaceReady && isBackendStarted) {          
      searchInputRef.current?.focus()
    }
  },[globalWorkspaceReady, isBackendStarted])

  useEffect(()=>{
    window.electron.on('server-ready', ()=>{
      setIsBackendStarted(true)
    })
  },[])

  useEffect(() => {
    const focusSearchInput = () => {
      searchInputRef.current?.focus()
    }

    window.electron.on('focus-search-bar', focusSearchInput)
  }, [])

  // Check for update
  useEffect(() => {
      window.electron.on('update-available', () => { updateTrigger?.current?.click() })
  }, [])

  // Get current usage
  useEffect(() => {
    try {
      window.electron.invoke('get-current-usage').then(usageData => {
        console.log(`User Current Usage: ${usageData.size} MB`)
        console.log(`User Usage Reset Date: ${usageData.resetDate}`)
        console.log(`User Premium End Date: ${usageData.premiumEndDate}`)

        setCurrentUsage(usageData.size) // Update the state with the fetched usage data

        setPremiumEndDate(new Date(usageData.premiumEndDate)) // Update the premium end date state
      })
    } catch (error) {
      console.error('Error fetching current usage:', error)
    }
}, [])

  // Write usage to file when currentUsage changes
  useEffect(() => {
    // Function to write the updated usage to file
    const writeUpdatedUsageToFile = async (newSize: number) => {
      try {
        const result = await window.electron.invoke('update-usage', newSize)
        console.log('Usage size updated in file:', result) // result should be 'success'
      } catch (error) {
        console.error('Error sending update usage to main process:', error)
      }
    }
  
    // Call the function with the new size whenever currentUsage changes
    if ( currentUsage !== 0 )
      writeUpdatedUsageToFile(currentUsage)
  }, [currentUsage])

  // Write PremiumEndDate to file when premiumEndDate changes
  useEffect(() => {
    const updatePremiumEndDateInFile = async () => {
      if (premiumEndDate) {
        try {
          const result = await window.electron.invoke('update-premium-end-date', premiumEndDate.toISOString())
          console.log('Premium end date updated in file:', result)
        } catch (error) {
          console.error('Error sending update to main process for premium end date:', error)
        }
      }
    }
  
    updatePremiumEndDateInFile()
  }, [premiumEndDate])

  // Check if premium feature usable
  useEffect(() => {
    // Check if premium end date has reached
    const isPremiumActive = premiumEndDate ? new Date() <= premiumEndDate : false

    // A user can use features if 
    // 1) they haven't exceeded the usage limit,
    // 2) or if their premium access is still active,
    // 3) or if they are logged in (not null) and their subscription plan is not FREE.
    const canUseFeature = currentUsage <= 200 || isPremiumActive || (user && user.subscription_plan !== SubscriptionPlan.FREE)
    
    // console.log('canUseFeature', currentUsage <= 200, isPremiumActive, (user && user.subscription_plan !== SubscriptionPlan.FREE), canUseFeature)

    setIsFeatureUsable(!!canUseFeature) // Explicitly cast to boolean to satisfy TypeScript's type checking
  }, [currentUsage, user, premiumEndDate])

  // Check if premium code used by others every 10 minutes
  useEffect(() => {
    checkAndExtendPremium();

    // const intervalId = setInterval(checkAndExtendPremium, 1*60*100); // 1 minute
    const intervalId = setInterval(checkAndExtendPremium, 10*60*100); // 10 minutes

    return () => clearInterval(intervalId);
  }, [])
  
  const checkAndExtendPremium = () => {
    window.electron.send('count_referral') // Request to count referrals and mark them

    // Handle the response
    window.electron.once('count_referral_response', (monthsToAdd) => {
        if (monthsToAdd > 0) {
            console.log('monthsToAdd', monthsToAdd)

            setPremiumEndDate(originalPremiumEndDate => {
              const currentDate = new Date()
              let newPremiumEndDate

              if (originalPremiumEndDate && originalPremiumEndDate > currentDate) {
                  // If the original premium end date is in the future, add 1 month to it
                  newPremiumEndDate = new Date(originalPremiumEndDate)
                  
                  console.log('originalPremiumEndDate', originalPremiumEndDate)
                  console.log('newPremiumEndDate', newPremiumEndDate)

                  newPremiumEndDate.setMonth(newPremiumEndDate.getMonth() + monthsToAdd)
              } else {
                  // If the original premium end date is today or in the past, set it to 1 month from today
                  newPremiumEndDate = new Date()
                  newPremiumEndDate.setMonth(currentDate.getMonth() + monthsToAdd)
              }

              return newPremiumEndDate
            })
        }
    })
  }
  
  const [pdfPath, setPdfPath] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pdfData, setPdfData] = useState<string | null>(null)
  const [pageLow, setPageLow] = useState<number | null>(null)
  const [initialPage, setInitialPage] = useState<number | null>(null)
  const [pageHigh, setPageHigh] = useState<number | null>(null)
  const [highlights, setHighlights] = useState<{ [key: number]: string[] }>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const [referenceText, setReferenceText] = useState<string|null>(null)
  const [displayPDF, setDisplayPDF] = useState<boolean>(false)

  useEffect(() => {
    const loadPdf = async () => {
        if (! pdfPath) {
          setPdfData(``)
          return
        }

        try {
            const data = await window.electron.invoke('load-pdf', pdfPath)
            setPdfData(`data:application/pdf;base64,${data}`)
        } catch (error) {
            console.error('Failed to load PDF:', error)
        }
    }
    loadPdf()
  }, [pdfPath])

  useEffect(() => {
    // Scroll to the initial page after the PDF is rendered
    console.log('initialPage',initialPage)
    const timeout = setTimeout(() => {
        if (containerRef.current) {
            const pageElement = containerRef.current.querySelector(`[data-page-number="${initialPage}"]`);
            if (pageElement) {
                pageElement.scrollIntoView({ behavior: 'instant' });
            }
        }
    }, 30); // Adjust the timeout duration if necessary
    return () => clearTimeout(timeout);
  }, [numPages, initialPage])

  const onDocumentLoadSuccess = useCallback(({ numPages }: LoadSuccessParams) => {
    setNumPages(numPages)
    extractText()
  }, [pdfData, pageLow, pageHigh, referenceText])

  const hasSharedSubsequence = (array1: string[], array2: string[], minLength = 6): boolean => {
    for (let i = 0; i <= array1.length - minLength; i++) {
        for (let j = 0; j <= array2.length - minLength; j++) {
            let k = 0;
            while (k < minLength && array1[i + k] === array2[j + k]) {
                k++;
            }
            if (k === minLength) {
                return true;
            }
        }
    }
    return false;
  };

  const extractText = useCallback(async () => {

    if (!pdfData || !pageHigh || !pageLow) return;

    const loadingTask = pdfjs.getDocument({ data: atob(pdfData.split(',')[1]) })
    const pdf = await loadingTask.promise

    const newHighlights: { [key: number]: string[] } = {}

    const query = referenceText ? referenceText : ''
    const queryTokens = query.split(' ').filter(token => token)

    console.log('queryTokens', queryTokens)

    // load text for each page and search if the page contains the text to highlight
    for (let pageNum = pageLow; pageNum <= pageHigh; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map(item => (item as any).str).join(' ')
        const pageTokens = pageText.split(' ').filter(token => token)

        if (pageNum == 1)
            console.log('pageTokens', pageTokens)

        // Check if the pageTokens array shares a subsequence of length minLength with the queryTokens array
        if (hasSharedSubsequence(pageTokens, queryTokens)) {
          console.log('found text');
          newHighlights[pageNum] = [query];
        }
    }

    setHighlights(newHighlights);
  }, [pdfData, pageLow, pageHigh, referenceText])

  const customTextRenderer = useCallback(({ str, pageNumber }: { str: string, pageNumber: number }) => {
    function escapeRegExp(string: string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escapes special regex characters
    }
    const strTokens = str.split(' ').filter(token => token)

    if (highlights[pageNumber] && highlights[pageNumber].some(highlight => hasSharedSubsequence(strTokens, highlight.split(' ').filter(token => token), 7))) {
        // const parts = str.split(new RegExp(`(${highlights[pageNumber].join('|')})`, 'gi')).filter(part => part)
        const parts = str.split(new RegExp(`(${highlights[pageNumber].map(escapeRegExp).join('|')})`, 'gi')).filter(part => part);

        return parts.map((part, index) => {
            const partTokens = part.split(' ').filter(token => token)
            if (highlights[pageNumber].includes(part) || hasSharedSubsequence(partTokens, highlights[pageNumber].join(' ').split(' ').filter(token => token), 7)) {
                setInitialPage(pageNumber)
                return `<span style="background-color: yellow; color: black;" key=${index}>${part}</span>`
            }
            return part
        }).join('')
    }
    return str
  }, [highlights, pageLow])


  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    const openPdf = async () => {
      if (! pdfPath) return
  
      try {
          await window.electron.invoke('open-pdf', pdfPath)
      } catch (error) {
          console.error('Failed to OPEN PDF:', error)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') { // Use optional chaining and nullish coalescing to handle null globalSearchResults
        setSelectedIndex(prevIndex => Math.max(0, prevIndex - 1));
      } else if (event.key === 'ArrowDown') { // Increment index but not above max, handle null case
        if (globalSearchResults) {
          setSelectedIndex(prevIndex => Math.min(globalSearchResults.length - 1, prevIndex + 1));
        }
      } else if (event.key === 'ArrowRight') {
        setDisplayPDF(true)
      } else if (event.key === 'Enter' && displayPDF) {
        openPdf() // Call openPdf when Enter is pressed
      } else {
        // Make sure search bar is focused and ready to search, esp on application start
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [globalSearchResults, displayPDF])

  // Update the PDF path when the selected index changes
  useEffect(() => {
    if (globalSearchResults && globalSearchResults.length > selectedIndex) {
      const selectedResult = globalSearchResults[selectedIndex];
      setPdfPath(selectedResult.result_source);
      setPageLow(Math.max(1, selectedResult.page_low - 3));
      setPageHigh(selectedResult.page_high + 3);
      setReferenceText(selectedResult.result_text);
    } else {
      // Reset or set to default values if needed
      setPdfPath(null);
      setPageLow(null);
      setPageHigh(null);
      setInitialPage(null);
      setReferenceText(null);
    }
  }, [selectedIndex, globalSearchResults])

  return (
    <div className='basic-page-setup h-center-align'>
      {
        isBackendStarted
        ?
        (
          ! globalWorkspaceReady
          ?
            <div className='starter-page'>
              <h2>Welcome to PocketLLM</h2>
              <div className='progress-intro-text'>
                <p>Please wait, this process usually takes a few minutes</p>
                <p>Privacy guaranteed: All data stays completely offline</p>
              </div>
              <div style={{display: 'flex', alignItems: "center"}}>
                <CircularWithValueLabel progress={globalIndexProgress}/>
                <div className='progress-text'>Preparing ... </div>
              </div>
            </div>
          :
          <div style={{display: "flex", width: "100%", alignItems: "start"}}>
            <div className='search-res-frame'>
              <input  placeholder='Search' 
                          className='search-bar'
                          value={globalSearchStr}
                          ref={searchInputRef}
                          onChange={(e) => {
                            setGlobalSearchStr(e.target.value); 
                            debouncedSearch(e.target.value)
                            setDisplayPDF(false)
                          }}
                  />
              
                
                {
                  globalSearchResults && globalSearchResults?.length > 0?
                  <div>
                    <hr className='search-line-main'/>
                    <div className='search-scroll-frame'>
                      {
                        globalSearchResults.map((result, idx)=>{
                          return (
                            <div key={idx}>
                              <hr className='search-line'/>
                                <div style={{display: "flex"}}>
                                  <div key={idx} className={idx == selectedIndex? 'search-res-item search-select' : "search-res-item"}>
                                    <div className='search-res-text'>{highlightText(result.result_text, keywords)}</div>
                                    {
                                      idx == selectedIndex?
                                      <div className='enter-reminder'>
                                        {
                                          displayPDF
                                          ?
                                          <div className='enter-reminder'>
                                            <div style={{marginRight: "5px"}}>Press Enter</div>
                                            <i className="bi bi-box-arrow-up-right"></i>
                                          </div>
                                          :
                                          <div style={{marginRight: "5px"}}><i className="bi bi-arrow-right"></i></div>
                                        }
                                      </div>
                                      :
                                      <></>
                                    }
                                    
                                  </div>
                                </div>
                              
                            </div>
                            
                          )
                        })
                      }
                    </div>
                  </div>
                  :
                  <></>
                }
            </div>
              {
                displayPDF && pageLow && pageHigh &&
                <div ref={containerRef} style={{ height: '80vh', width: '100%', overflow: 'auto', marginLeft: "20px"}}>
                  {pdfData && (
                      <Document
                          file={pdfData}
                          onLoadSuccess={onDocumentLoadSuccess}
                      >
                        {numPages && Array.from(
                            { length: Math.min(pageHigh - pageLow + 1, numPages - pageLow + 1) },
                            (_, index) => (
                                <Page
                                    key={`page_${index + pageLow}`}
                                    pageNumber={index + pageLow}
                                    customTextRenderer={({ str }) => customTextRenderer({ str, pageNumber: index + pageLow })}
                                />
                            )
                        )}
                      </Document>
                  )}
                </div>
              }
          </div>
            
        )
        :
        <div className='starter-page'>
          <h2>Welcome to PocketLLM</h2>
          <div className='progress-intro-text'>
            <p>starting up the backend ...</p>
          </div>
        </div>
      }

    </div>
  )
}

export default App
