interface SummaryProps {
  summary: string;
}

export default function Summary( { summary }: SummaryProps ) {
  return (
    summary.length === 0 ?
    <></>
    :
    <div className='summary p-4 rounded-3 mb-3'>
       { summary }
    </div>
  )
}
