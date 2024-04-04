import { useState, useEffect, useContext, useRef } from 'react'
import axios from 'axios'
import ChatBot from '../components/ChatBot'
import ChatCustomer from '../components/ChatCustomer'
import { usePort } from '../contexts/PortContext'
import { SetAlertMessageContext } from '../contexts/SetAlertMessageContext'

type chatPageProps = {
  curWorkSpaceID: string | null
}

interface ChatMessage {
  content: string
  sender: 'human' | 'AI'
  tempId?: number // Optional property for temporary chat messages
}

// Define the structure of a chat reference, which includes the AI answer and the document reference
export interface ChatReference {
  ai_answer: string
  filtered_doc_ref_info: DocumentReference[]
}

// Define the structure of a single document reference
interface DocumentReference {
  id: string
  filename: string
  page: number
}

export default function ChatPage({curWorkSpaceID}: chatPageProps) {
  const { port } = usePort()
  const [message, setMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatReferences, setChatReferences] = useState<ChatReference[]>([])

  const scrollRef = useRef<HTMLDivElement>(null);
  const setAlertMessage = useContext(SetAlertMessageContext)

  const fetchChatHistory = async (sessionId: string) => {
    try {
      const response = await axios.post(`http://localhost:${port}/get_chat_history`, {
        session_id: sessionId
      })
      setChatHistory(response.data.chat_history)
      setChatReferences(response.data.chat_references)
    } catch (error) {
      console.error("Failed to fetch chat history", error)
    }
  }

  const handleSendMessage = async (e: React.KeyboardEvent) => {
    e.preventDefault() // Prevent the form from actually submitting

    if (!message.trim()) return // Don't send empty messages

    // Clear the textarea immediately after the message is sent
    setMessage('')

    // Temporarily add a loading message to the chat history
    const tempChatHistoryId = Date.now() // Unique ID for the temporary loading message
    setChatHistory((prevChatHistory) => [
      ...prevChatHistory,
      { content: message, sender: 'human', tempId: tempChatHistoryId },
      { content: 'Loading...', sender: 'AI', tempId: tempChatHistoryId },
    ])

    try {
      const response = await axios.post(`http://localhost:${port}/chat`, {
        prompt: message,
        session_id: curWorkSpaceID
      })

      const aiResponse: string = response.data.response;
      const references = response.data.references || []

      setChatReferences(references)

      setChatHistory((prevChatHistory) =>
        prevChatHistory.map((chat) => {
          if (chat.tempId === tempChatHistoryId) { // Identify the message by tempId
            if (chat.sender === 'AI') {
              return { content: aiResponse, sender: 'AI' } // For AI, update the message content with the actual response and remove tempId
            } else if (chat.sender === 'human') {
              return { content: chat.content, sender: chat.sender } // For human, just remove the tempId, keep content as is
            }
          }
          return chat // Return unmodified chat if none of the above conditions are met
        })
      )

    } catch (error: unknown) {
      console.error("Error sending message:", error)

      setMessage(message) // Restore human prompt

      // Remove the loading message
      setChatHistory((prevChatHistory) =>
        prevChatHistory.filter((chat) => chat.tempId !== tempChatHistoryId),
      )
      
      if (axios.isAxiosError(error)) {
        // Check if the error is an AxiosError
        setAlertMessage(`Error: ${error.response?.data?.detail}` || "An error occurred while sending the message.")
      } else {
        // If it's not an AxiosError, it might be some other type of error
        setAlertMessage("An unexpected error occurred.")
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e)
    }
  }

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({behavior: "smooth", block: "end", inline: "nearest"});
  }

  const clearChatHistory = async (sessionId: string) => {
    try {
      const response = await axios.post(`http://localhost:${port}/delete_chat_history`, {
        session_id: sessionId,
      })

      if (response.status === 200) {
        setChatHistory([]) // Reset chat history
        setChatReferences([]) // Reset reference
      }
    } catch (error) {
      console.error("Error clearing chat history:", error)
      setAlertMessage(`Failed to clear chat history: ${error}`)
    }
  }

  useEffect(() => {
    if (chatHistory.length > 0) {
      scrollToBottom()
    }
  }, [chatHistory])

  useEffect(()=>{
    if (curWorkSpaceID) {
      fetchChatHistory(curWorkSpaceID)
    }
  },[curWorkSpaceID])

  return (
    <div className='w-100 h-100 position-relative p-1 pt-0'>
      <div className='d-flex justify-content-center mb-3' onClick={()=>clearChatHistory(curWorkSpaceID!)}>
          <div className='clear-chat font-sm text-primary'>
              <i className="bi bi-clock-history fs-5 me-2"></i>
              Clear chat
          </div>
      </div>
      
        <div className='d-flex flex-column justify-content-between' style={{height: "74vh"}}>
            <div style={{height: "60vh", overflowY: "auto"}}>
              <div ref={scrollRef}>
                {chatHistory && chatHistory.map((chat, index) => chat.sender === 'AI' ?
                  <ChatBot key={index} message={chat.content} reference={chatReferences.find(chatReference => chatReference.ai_answer === chat.content)} /> : 
                  <ChatCustomer key={index} message={chat.content} />
                )}
              </div>

            </div>
            
            <form className='chat-input-box'>
                <textarea className='chat-textarea'
                          value={message}
                          onChange={handleChange}
                          onKeyDown={handleKeyDown}
                />
            </form>
            
        </div>
        
    </div>
  )
}
