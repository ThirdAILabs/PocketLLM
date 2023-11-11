type chipProps = {
    name: String;
    selected : Boolean;
    icon: String;
}

export default function ModelChip({name, selected, icon} : chipProps) {

  return (
    <button className={`model-chip btn btn-general d-flex align-items-center w-100 font-sm rounded-2 p-1 px-2 text-start mb-2 px-2 ${selected ? " chip-selected" : ""}`}
    >
      <div className="me-2">{icon}</div>
      {name}
    </button>
  )
}
