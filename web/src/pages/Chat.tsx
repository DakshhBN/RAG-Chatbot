import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'motion/react'
import { FileText } from 'lucide-react'
import { ChatInput } from '@/components/ChatInput'
import { ChatMessage } from '@/components/ChatMessage'
import { streamChat } from '@/lib/chat'
import { getThreadMessages, listThreads, type Message } from '@/lib/threads'

export default function Chat() {
  const { threadId } = useParams<{ threadId: string }>()
  const [title, setTitle] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!threadId) return
    setLoading(true)
    setTitle(null)
    Promise.all([getThreadMessages(threadId), listThreads()])
      .then(([msgs, threads]) => {
        setMessages(msgs)
        setTitle(threads.find((t) => t.id === threadId)?.title ?? null)
      })
      .catch(() => toast.error('Could not load this chat.'))
      .finally(() => setLoading(false))

    return () => abortRef.current?.abort()
  }, [threadId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(content: string) {
    if (!threadId) return
    setMessages((prev) => [...prev, { role: 'user', content }, { role: 'assistant', content: '' }])
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    await streamChat({
      threadId,
      content,
      signal: controller.signal,
      onChunk: (chunk) => {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          next[next.length - 1] = { ...last, content: last.content + chunk }
          return next
        })
      },
      onDone: () => setStreaming(false),
      onError: (message) => {
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: `⚠️ ${message}` }
          return next
        })
        setStreaming(false)
      },
    })
  }

  if (!threadId) return null

  return (
    <motion.div
      key={threadId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex h-full flex-col"
    >
      <div className="flex items-center gap-2 border-b px-5 py-3">
        <FileText className="size-4 text-muted-foreground" />
        <AnimatePresence mode="wait">
          <motion.span
            key={title ?? 'chat'}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="truncate text-sm font-medium"
          >
            {title ?? 'Chat'}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 p-5">
          {loading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}
          {!loading && messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Ask anything about this document.
            </p>
          )}
          {messages.map((message, i) => (
            <ChatMessage key={i} message={message} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
      <ChatInput onSend={handleSend} disabled={streaming || loading} />
    </motion.div>
  )
}
