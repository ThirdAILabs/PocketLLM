type toastProps = {
  status: number;
}

export default function Toast({status}: toastProps) {

  return (
    <>
    {
      status == 0 ?
      <div className='toast-wrapper bg-warning bg-opacity-10 p-3 text-warning rounded-3 font-sm'>
        Something goes wrong. Please try again later.
      </div>
      :
      <div className='toast-wrapper bg-success bg-opacity-10 p-3 text-success rounded-3 font-sm'>
        Success. Concept learnt.
      </div>
    }
    </>
  )
}
