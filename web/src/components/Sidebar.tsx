import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'motion/react'
import {
  FileText,
  LogOut,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { DocumentStatusBadge } from '@/components/DocumentStatusBadge'
import {
  deleteDocument,
  listDocuments,
  uploadDocument,
  type Document,
} from '@/lib/documents'
import { createThread, deleteThread, listThreads, type Thread } from '@/lib/threads'
import { cn } from '@/lib/utils'

function initials(email: string) {
  return email.slice(0, 2).toUpperCase()
}

const listItemMotion = {
  layout: true,
  initial: { opacity: 0, y: -6, height: 0 },
  animate: { opacity: 1, y: 0, height: 'auto' },
  exit: { opacity: 0, x: -12, height: 0, transition: { duration: 0.15 } },
  transition: { duration: 0.22, ease: 'easeOut' as const },
}

export function Sidebar() {
  const navigate = useNavigate()
  const { threadId: activeThreadId } = useParams()
  const { user, logout } = useAuth()

  const [documents, setDocuments] = useState<Document[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    const [docs, thrs] = await Promise.all([listDocuments(), listThreads()])
    setDocuments(docs)
    setThreads(thrs)
  }, [])

  useEffect(() => {
    refresh().catch(() => toast.error('Could not load your documents/chats.'))
  }, [refresh])

  useEffect(() => {
    if (!documents.some((d) => d.status === 'processing')) return
    const interval = setInterval(() => {
      listDocuments()
        .then(setDocuments)
        .catch(() => {})
    }, 3000)
    return () => clearInterval(interval)
  }, [documents])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const doc = await uploadDocument(file)
      setDocuments((prev) => [doc, ...prev])
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function handleStartChat(doc: Document) {
    try {
      const thread = await createThread(doc.id)
      setThreads((prev) => [thread, ...prev])
      navigate(`/chat/${thread.id}`)
    } catch {
      toast.error('Could not start a chat for this document.')
    }
  }

  async function handleDeleteDocument(doc: Document, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete "${doc.original_filename}"? This also removes any chats using it.`)) return
    try {
      await deleteDocument(doc.id)
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
      await refresh()
    } catch {
      toast.error('Could not delete document.')
    }
  }

  async function handleDeleteThread(thread: Thread, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await deleteThread(thread.id)
      setThreads((prev) => prev.filter((t) => t.id !== thread.id))
      if (activeThreadId === thread.id) navigate('/')
    } catch {
      toast.error('Could not delete chat.')
    }
  }

  return (
    <div className="flex h-screen w-72 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-4">
        <motion.div
          initial={{ rotate: -8, scale: 0.9 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
        >
          <Sparkles className="size-4" />
        </motion.div>
        <span className="font-semibold">RAG Chatbot</span>
      </div>

      <div className="px-3 pb-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          className="w-full shadow-sm transition-transform active:scale-[0.98]"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className={cn('size-4', uploading && 'animate-pulse')} />
          {uploading ? 'Uploading…' : 'Upload PDF'}
        </Button>
      </div>

      <ScrollArea className="scrollbar-thin flex-1 px-3">
        <div className="px-1 pt-3 pb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Documents
        </div>
        <div className="flex flex-col gap-1 pb-3">
          {documents.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No PDFs uploaded yet.</p>
          )}
          <AnimatePresence initial={false}>
            {documents.map((doc) => (
              <motion.button
                key={doc.id}
                {...listItemMotion}
                whileHover={doc.status === 'ready' ? { x: 2 } : undefined}
                whileTap={doc.status === 'ready' ? { scale: 0.98 } : undefined}
                onClick={() => doc.status === 'ready' && handleStartChat(doc)}
                disabled={doc.status !== 'ready'}
                className={cn(
                  'group flex items-center justify-between gap-2 overflow-hidden rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent',
                  doc.status === 'ready' ? 'cursor-pointer' : 'cursor-default opacity-70',
                )}
                title={doc.error_message ?? undefined}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <FileText className="size-3.5" />
                  </span>
                  <span className="truncate">{doc.original_filename}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <DocumentStatusBadge status={doc.status} />
                  <span
                    role="button"
                    onClick={(e) => handleDeleteDocument(doc, e)}
                    className="rounded p-1 opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </span>
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        <div className="px-1 pt-2 pb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Chats
        </div>
        <div className="flex flex-col gap-1 pb-4">
          {threads.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              Upload a PDF, then start a chat from it.
            </p>
          )}
          <AnimatePresence initial={false}>
            {threads.map((thread) => (
              <motion.button
                key={thread.id}
                {...listItemMotion}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/chat/${thread.id}`)}
                className={cn(
                  'group relative flex items-center justify-between gap-2 overflow-hidden rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent',
                  activeThreadId === thread.id && 'bg-sidebar-accent font-medium',
                )}
              >
                {activeThreadId === thread.id && (
                  <motion.span
                    layoutId="active-thread-indicator"
                    className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="flex min-w-0 items-center gap-2.5">
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{thread.title ?? 'Untitled chat'}</span>
                </span>
                <span
                  role="button"
                  onClick={(e) => handleDeleteThread(thread, e)}
                  className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <div className="flex flex-col gap-1 border-t p-2">
        <Button variant="ghost" className="justify-start" onClick={() => navigate('/')}>
          <Plus className="size-4" />
          New chat
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                  {user ? initials(user.email) : '?'}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-muted-foreground">{user?.email}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} variant="destructive">
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
