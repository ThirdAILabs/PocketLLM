import lower from "../assets/logoLower.svg";
import middle from "../assets/logoMiddle.svg";
import upper from "../assets/logoUpper.svg";
import words from "../assets/logoWords.svg"

export default function LandingAnimation() {
  return (
    <div className='landing-animation-wrapper'>
        <div className='d-flex justify-content-center align-items-center w-100 h-100'>
            <div className='logo-wrapper me-3'>
                <div className='logo-upper-wrapper'>
                    <img className='logo-upper' placeholder='logo' src={upper}/>
                </div>
                <div className='logo-lower-wrapper'>
                    <img className='logo-lower' placeholder='logo' src={lower}/>
                </div>
                <div className='logo-middle-wrapper'>
                    <img className='logo-middle' placeholder='logo' src={middle}/>
                </div>
            </div>
            <img className='logo-words' src={words}/>
        </div>
        
    </div>
  )
}
