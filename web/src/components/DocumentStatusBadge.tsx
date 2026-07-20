import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DocumentStatus } from '@/lib/documents'

const LABELS: Record<DocumentStatus, string> = {
  processing: 'Processing…',
  ready: 'Ready',
  failed: 'Failed',
}

const VARIANTS: Record<DocumentStatus, 'default' | 'secondary' | 'destructive'> = {
  processing: 'secondary',
  ready: 'default',
  failed: 'destructive',
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge variant={VARIANTS[status]} className={cn(status === 'processing' && 'animate-pulse')}>
      {LABELS[status]}
    </Badge>
  )
}
