interface ChatCustomerProps {
  message: string
}

export default function ChatCustomer({message}: ChatCustomerProps){
  return (
    <div className='d-flex justify-content-end mb-3'>
        <div className='chat-bubble me-2 bg-primary bg-opacity-25'>
            {message}
        </div>
    </div>
  )
}
