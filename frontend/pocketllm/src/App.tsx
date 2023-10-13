import "bootstrap/dist/css/bootstrap.css";
import "bootstrap/dist/js/bootstrap.bundle.js";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styling.css";

import { useEffect, useState } from 'react';
import SearchBar from './components/searchBar';
import ModelName from './components/ModelNameTemplate';
import SelectFile from './components/SelectFile';
import FunctionBar from './components/FunctionBar';
import Summary from './components/Summary';
import Extraction from './components/Extraction';
import ModelCards from "./components/ModelCards";
import LandingAnimation from "./components/LandingAnimation";
import { HashRouter as Router, Route, Routes, Link } from 'react-router-dom';

import './App.css'


export interface SearchResult {
  page_high: number
  page_low: number
  result_source: string
  result_text: string
}

export interface SelectedFile {
  fileName: string;
  filePath: string;
  uuid: string;
}

export interface ModelDisplayInfo {
  author_name: string;
  model_name: string;
}

function App() {

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]); // Used inside <SearchBar/> and <Extraction/>
  const [summaryResult, setSummaryResult] = useState<string>(''); // Used inside <SearchBar/> and <Summary/>

  // Used inside <SelectFile/> for state persistence
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [indexFiles, setIndexFiles] = useState<SelectedFile[]>([]);
  const [progress, setProgress] = useState(0);
  const [startProgress, setStartProgress] = useState(false);

  // Used inside <ModelCards/> 
  const [currentModel, setCurrentModel] = useState<ModelDisplayInfo | null>(null);

  // Intro visual effect
  const [landing, setLanding] = useState(<LandingAnimation/>);

  useEffect(()=>{
    setTimeout(()=>{
      setLanding(<></>)
    }, 3550)
  }, [])

  return (

    <div className='full-page-height p-0'>
      
      <div className='d-flex flex-column align-items-center'>

        <Router>
          <Routes>

              <Route path="/ModelCards" element={<ModelCards setCurrentModel={setCurrentModel} />} />
              
              <Route path="/" element = {
                <>
                  <Link to="/ModelCards">
                    <button className="btn font-sm mb-3 btn-general text-white bg-secondary bg-opacity-75">View Model Cards</button>
                  </Link>

                  <div className='d-flex mb-3 align-items-center'>
                    <SelectFile
                          selectedFiles={selectedFiles}
                          setSelectedFiles={setSelectedFiles}
                          indexFiles={indexFiles}
                          setIndexFiles={setIndexFiles}
                          progress={progress}
                          setProgress={setProgress}
                          startProgress={startProgress}
                          setStartProgress={setStartProgress}
                    />
                    <ModelName modelInfo = {currentModel}/>
                  </div>

                  <FunctionBar/>

                  <SearchBar onSearch = {setSearchResults} onSummary = {setSummaryResult}/>

                  <div style={{minWidth: "60vw", maxWidth: "70vw"}}>
                    <Summary summary = {summaryResult}/>
                    <Extraction searchResults={searchResults}/>
                  </div>
                </>

              }>

              </Route>

          </Routes>
        </Router>


      </div>
      {landing}
    </div>

  )
}

export default App
