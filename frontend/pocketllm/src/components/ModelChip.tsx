type chipProps = {
    name: String;
    selected : Boolean
}

export default function ModelChip({name, selected} : chipProps) {

  return (
    <button className={`model-chip btn btn-general bg-dark bg-opacity-10 font-sm rounded-3 p-1 px-2 text-center mb-2 me-2 ${selected ? " chip-selected" : ""}`}
        style={{width: "fit-content"}}
    >
        {name}
    </button>
  )
}
