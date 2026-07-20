import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'motion/react'
import {
  Check,
  FileText,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { createThread, deleteThread, listThreads, renameThread, type Thread } from '@/lib/threads'
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

const MIN_WIDTH = 200
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 256
const WIDTH_STORAGE_KEY = 'sidebar-width'

export function Sidebar() {
  const navigate = useNavigate()
  const { threadId: activeThreadId } = useParams()
  const { user, logout } = useAuth()

  const [documents, setDocuments] = useState<Document[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [width, setWidth] = useState(() => {
    const stored = Number(localStorage.getItem(WIDTH_STORAGE_KEY))
    return stored >= MIN_WIDTH && stored <= MAX_WIDTH ? stored : DEFAULT_WIDTH
  })
  const widthRef = useRef(width)
  const resizingRef = useRef(false)

  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    widthRef.current = width
  }, [width])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizingRef.current) return
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX)))
    }
    function onMouseUp() {
      if (!resizingRef.current) return
      resizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem(WIDTH_STORAGE_KEY, String(widthRef.current))
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    resizingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    if (renamingThreadId) renameInputRef.current?.focus()
  }, [renamingThreadId])

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

  function startRename(thread: Thread, e: React.MouseEvent) {
    e.stopPropagation()
    setRenamingThreadId(thread.id)
    setRenameValue(thread.title ?? '')
  }

  function cancelRename(e?: React.MouseEvent) {
    e?.stopPropagation()
    setRenamingThreadId(null)
    setRenameValue('')
  }

  async function saveRename(thread: Thread, e?: React.MouseEvent | React.FormEvent) {
    e?.stopPropagation()
    e?.preventDefault()
    const title = renameValue.trim()
    setRenamingThreadId(null)
    if (!title || title === thread.title) return
    try {
      const updated = await renameThread(thread.id, title)
      setThreads((prev) => prev.map((t) => (t.id === thread.id ? updated : t)))
    } catch {
      toast.error('Could not rename chat.')
    }
  }

  return (
    <div
      style={{ width }}
      className="relative flex h-screen shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground"
    >
      <div className="flex items-center gap-2 px-4 py-4">
        <motion.div
          initial={{ rotate: -8, scale: 0.9 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
        >
          <Sparkles className="size-4" />
        </motion.div>
        <span className="font-semibold">PdfGini</span>
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
              // Not a <button> — the delete icon button is a sibling, and
              // interactive elements can't validly nest inside a <button>.
              <motion.div
                key={doc.id}
                {...listItemMotion}
                role="button"
                tabIndex={0}
                whileHover={doc.status === 'ready' ? { x: 2 } : undefined}
                whileTap={doc.status === 'ready' ? { scale: 0.98 } : undefined}
                onClick={() => doc.status === 'ready' && handleStartChat(doc)}
                onKeyDown={(e) => e.key === 'Enter' && doc.status === 'ready' && handleStartChat(doc)}
                aria-disabled={doc.status !== 'ready'}
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
                  <button
                    type="button"
                    onClick={(e) => handleDeleteDocument(doc, e)}
                    className="rounded p-1 opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </button>
                </span>
              </motion.div>
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
            {threads.map((thread) => {
              const isRenaming = renamingThreadId === thread.id
              return (
                <motion.div
                  key={thread.id}
                  {...listItemMotion}
                  className={cn(
                    'group relative flex items-center gap-2 overflow-hidden rounded-lg text-sm transition-colors',
                    !isRenaming && 'hover:bg-sidebar-accent',
                    !isRenaming && activeThreadId === thread.id && 'bg-sidebar-accent font-medium',
                  )}
                >
                  {activeThreadId === thread.id && (
                    <motion.span
                      layoutId="active-thread-indicator"
                      className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}

                  {isRenaming ? (
                    <form
                      onSubmit={(e) => saveRename(thread, e)}
                      className="flex w-full items-center gap-1 px-2 py-1.5"
                    >
                      <Input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Escape' && cancelRename()}
                        onClick={(e) => e.stopPropagation()}
                        className="h-7 flex-1 text-sm"
                      />
                      <button
                        type="submit"
                        className="shrink-0 rounded p-1 hover:bg-primary/10"
                        title="Save"
                      >
                        <Check className="size-3.5 text-primary" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="shrink-0 rounded p-1 hover:bg-destructive/10"
                        title="Cancel"
                      >
                        <X className="size-3.5 text-muted-foreground" />
                      </button>
                    </form>
                  ) : (
                    // Not a <button> — it contains the rename/delete icon buttons
                    // as siblings, and interactive elements can't validly nest
                    // inside a <button> (motion.button renders one).
                    <motion.div
                      role="button"
                      tabIndex={0}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate(`/chat/${thread.id}`)}
                      onKeyDown={(e) => e.key === 'Enter' && navigate(`/chat/${thread.id}`)}
                      className="flex flex-1 cursor-pointer items-center justify-between gap-2 overflow-hidden px-2.5 py-2 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{thread.title ?? 'Untitled chat'}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => startRename(thread, e)}
                          className="rounded p-1 opacity-0 transition-opacity hover:bg-primary/10 group-hover:opacity-100"
                        >
                          <Pencil className="size-3.5 text-muted-foreground" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteThread(thread, e)}
                          className="rounded p-1 opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </button>
                      </span>
                    </motion.div>
                  )}
                </motion.div>
              )
            })}
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

      <div
        onMouseDown={handleResizeStart}
        className="absolute top-0 right-0 z-10 h-full w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50"
      />
    </div>
  )
}
