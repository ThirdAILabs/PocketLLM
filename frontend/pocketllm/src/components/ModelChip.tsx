type chipProps = {
    name: String
}

export default function ModelChip({name} : chipProps) {
  return (
    <button className='btn btn-general bg-dark bg-opacity-10 font-sm rounded-3 p-1 px-2 text-center mb-2 me-2'
        style={{width: "fit-content"}}
    >
        {name}
    </button>
  )
}
