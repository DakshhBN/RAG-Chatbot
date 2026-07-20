import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { FileText, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react'

const FEATURES = [
  { icon: FileText, text: 'Upload any PDF and it becomes a dedicated knowledge base' },
  { icon: MessageSquareText, text: 'Ask questions and get answers grounded only in that document' },
  { icon: ShieldCheck, text: 'No hallucinations — it says "I don\'t know" when the answer isn\'t there' },
]

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-blob absolute top-[-10%] left-[-5%] size-96 rounded-full bg-primary-foreground/20 blur-3xl" />
          <div className="animate-blob-delayed absolute right-[-10%] bottom-[-15%] size-[28rem] rounded-full bg-primary-foreground/15 blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative flex items-center gap-2 text-lg font-semibold"
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-foreground/15">
            <Sparkles className="size-4.5" />
          </div>
          PdfGini
        </motion.div>

        <div className="relative flex flex-col gap-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h1 className="text-3xl leading-tight font-semibold text-balance">
              Chat with your documents, not the whole internet.
            </h1>
            <p className="mt-3 max-w-md text-primary-foreground/80">
              Upload a PDF and get a focused assistant that only answers from what's actually in it.
            </p>
          </motion.div>
          <ul className="flex flex-col gap-4">
            {FEATURES.map(({ icon: Icon, text }, i) => (
              <motion.li
                key={text}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.25 + i * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-foreground/15">
                  <Icon className="size-4" />
                </div>
                <span className="text-sm text-primary-foreground/90">{text}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">Powered by Groq, Pinecone &amp; fastembed</p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}
