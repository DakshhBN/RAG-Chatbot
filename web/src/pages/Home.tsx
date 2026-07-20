import { motion } from 'motion/react'
import { FileText } from 'lucide-react'

export default function Home() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <FileText className="size-7" />
      </motion.div>
      <p className="text-lg font-semibold">Upload a PDF to get started</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Once it finishes processing, click it in the sidebar to start a chat that only answers from
        that document — nothing else.
      </p>
    </motion.div>
  )
}
