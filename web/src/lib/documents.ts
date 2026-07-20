import { api } from '@/lib/api'

export type DocumentStatus = 'processing' | 'ready' | 'failed'

export interface Document {
  id: string
  original_filename: string
  status: DocumentStatus
  page_count: number | null
  error_message: string | null
  created_at: string
}

export async function uploadDocument(file: File): Promise<Document> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<Document>('/api/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function listDocuments(): Promise<Document[]> {
  const { data } = await api.get<Document[]>('/api/documents')
  return data
}

export async function getDocument(id: string): Promise<Document> {
  const { data } = await api.get<Document>(`/api/documents/${id}`)
  return data
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/api/documents/${id}`)
}
