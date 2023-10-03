export type ModelCardProps = {
    name: String,
    description: String,
    status: Number,
    publishDate: String,
    trainSet: String,
    diskSize: String,
    ramSize: String
}

export default function ModelCard({name, description, status, publishDate, trainSet, diskSize, ramSize}: ModelCardProps) {
  return (
    <div  className='model-card p-4 rounded-3 mb-3 d-flex flex-column justify-content-between'>
        <div>
            <div className='fw-bold'>{"thirdai / " + name}</div>
            <div className='font-sm text-dark mb-2'>{description}</div>
        </div>
        
        {
            status == 0 ?
            <div className='d-flex align-items-start'>
                <i className="bi bi-check-circle-fill text-primary fs-4"></i>
                <div className='d-flex align-items-end'>
                    <div className='mx-3 pt-2'>
                        <div className='fw-bold' style={{fontSize: "11pt"}}>Add your documents</div>
                        <div className='text-secondary my-1'style={{fontSize: "9pt"}}>{"Published " + publishDate}</div>
                        <div className='text-secondary my-1'style={{fontSize: "9pt"}}>{"Trained on " + trainSet}</div>
                        <div className='text-secondary my-1'style={{fontSize: "9pt"}}>{"On-disk: " + diskSize + ", RAM: " + ramSize}</div>
                    </div>
                    <button className='btn btn-general px-3 fw-bold bg-primary bg-opacity-10 text-primary rounded-4'>USE</button>
                </div>
            </div>
            :
            <div className='d-flex align-items-start'>
                <i className="bi bi-exclamation-circle-fill text-success fs-4"></i>
                <div className='d-flex align-items-end'>
                    <div className='mx-3 pt-2'>
                        <div className='fw-bold' style={{fontSize: "11pt"}}>Shipped with documents</div>
                        <div className='text-secondary my-1'style={{fontSize: "9pt"}}>{"Published " + publishDate}</div>
                        <div className='text-secondary my-1'style={{fontSize: "9pt"}}>{"Trained on " + trainSet}</div>
                        <div className='text-secondary my-1'style={{fontSize: "9pt"}}>{"On-disk: " + diskSize + ", RAM: " + ramSize}</div>
                    </div>
                    <button className='btn btn-general px-3 fw-bold text-primary'><i className="bi bi-cloud-download fs-2"></i></button>
                    
                </div>
            </div>
        }
    </div>
  )
}
