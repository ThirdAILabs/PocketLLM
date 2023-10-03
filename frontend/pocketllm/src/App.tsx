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

function App() {

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]); // Define a suitable type for search results
  const [summaryResult, setSummaryResult] = useState<string>('');
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

              <Route path="/ModelCards" element={<ModelCards />} />
              
              <Route path="/" element = {
                <>
                  <Link to="/ModelCards">
                    <button className="btn font-sm mb-3 btn-general text-white bg-secondary bg-opacity-75">View Model Cards</button>
                    </Link>

                  <div className='d-flex mb-3 align-items-center'>
                    <SelectFile/>
                    <ModelName model="General-QnA" modelType="Local Model"/>
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
