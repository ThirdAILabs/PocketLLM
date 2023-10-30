type Clearification = {
    setRead: React.Dispatch<React.SetStateAction<boolean>>,
    clarifyItem: string
  }

export default function Clearification( {setRead, clarifyItem} : Clearification) {
  return (
    <>
      <button className='btn font-sm btn-general border border-dark-subtle mx-1' data-bs-toggle="modal" data-bs-target="#warnOpenAI">{clarifyItem}</button>

      <form className="modal fade" id="warnOpenAI" tabIndex={-1} aria-hidden="true">
          <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                  <div className="modal-header border-0 ">
                      <button type="button" className="btn-close modal-close-btn" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div className="modal-body pt-0">
                      <div className='d-flex justify-content-center mb-3'>Privacy notice: Are you sure to send email content to GPT3.5-Turbo model?</div>
                      <div className='d-flex justify-content-center mb-3'>
                          <button className='btn bg-secondary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                  type="button"
                                  data-bs-dismiss="modal"
                                  onClick={()=>setRead(false)}>
                              Cancel
                          </button>
                          <button className='btn bg-primary bg-opacity-25 btn-sm grey-btn btn-general px-3 rounded-3 mx-1'
                                  type="button"
                                  data-bs-dismiss="modal"
                                  onClick={()=>setRead(true)}>
                              Consent
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      </form>

    </>
  )
}
