import { API_BASE_URL, getToken } from '@/lib/api'

interface StreamChatOptions {
  threadId: string
  content: string
  onChunk: (content: string) => void
  onDone: () => void
  onError: (message: string) => void
  signal?: AbortSignal
}

// EventSource can't send an Authorization header, so streaming is done by hand
// via fetch() + a ReadableStream reader, parsing Server-Sent-Events frames
// ("event: ...\ndata: ...\n\n") out of the raw byte stream ourselves.
export async function streamChat({
  threadId,
  content,
  onChunk,
  onDone,
  onError,
  signal,
}: StreamChatOptions): Promise<void> {
  const token = getToken()
  const response = await fetch(`${API_BASE_URL}/api/chat/${threadId}/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ content }),
    signal,
  })

  if (!response.ok || !response.body) {
    onError(`Request failed with status ${response.status}`)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''

    for (const frame of frames) {
      let event = 'message'
      let data = ''
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        if (line.startsWith('data:')) data = line.slice(5).trim()
      }
      if (!data) continue

      if (event === 'error') {
        const parsed = JSON.parse(data)
        onError(parsed.error ?? 'Unknown error')
        continue
      }
      if (event === 'done') {
        onDone()
        continue
      }
      const parsed = JSON.parse(data)
      if (parsed.content) onChunk(parsed.content)
    }
  }
}
