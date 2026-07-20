import { api } from '@/lib/api'

export interface Thread {
  id: string
  document_id: string | null
  title: string | null
  created_at: string
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function listThreads(): Promise<Thread[]> {
  const { data } = await api.get<Thread[]>('/api/threads')
  return data
}

export async function createThread(documentId: string, title?: string): Promise<Thread> {
  const { data } = await api.post<Thread>('/api/threads', { document_id: documentId, title })
  return data
}

export async function renameThread(id: string, title: string): Promise<Thread> {
  const { data } = await api.patch<Thread>(`/api/threads/${id}`, { title })
  return data
}

export async function deleteThread(id: string): Promise<void> {
  await api.delete(`/api/threads/${id}`)
}

export async function getThreadMessages(id: string): Promise<Message[]> {
  const { data } = await api.get<Message[]>(`/api/threads/${id}/messages`)
  return data
}
