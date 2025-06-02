import { authenticatedFetch } from './auth'

export interface UploadProgress {
  fileId: string
  fileName: string
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
  uploadUrl?: string
  downloadUrl?: string
}

export interface UploadSession {
  uploadUrl: string
  fileId: string
  fileName: string
  fileSize: number
  chunkSize: number
}

/**
 * Get signed upload URL from our API
 */
export async function getUploadSession(file: File): Promise<UploadSession> {
  const response = await authenticatedFetch('/api/upload/init', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to initialize upload: ${error}`)
  }

  return await response.json()
}

/**
 * Upload file in chunks with progress tracking
 */
export async function uploadFileWithProgress(
  file: File,
  onProgress: (progress: UploadProgress) => void
): Promise<string> {
  try {
    // Initialize upload session
    onProgress({
      fileId: '',
      fileName: file.name,
      progress: 0,
      status: 'pending'
    })

    const session = await getUploadSession(file)

    onProgress({
      fileId: session.fileId,
      fileName: file.name,
      progress: 0,
      status: 'uploading'
    })

    // Upload file using the signed URL
    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          onProgress({
            fileId: session.fileId,
            fileName: file.name,
            progress,
            status: 'uploading'
          })
        }
      })

      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            // Notify our API that upload is complete
            const completeResponse = await authenticatedFetch('/api/upload/complete', {
              method: 'POST',
              body: JSON.stringify({
                fileId: session.fileId,
                fileName: file.name,
                fileSize: file.size,
              }),
            })

            if (!completeResponse.ok) {
              throw new Error('Failed to complete upload')
            }

            const result = await completeResponse.json()

            onProgress({
              fileId: session.fileId,
              fileName: file.name,
              progress: 100,
              status: 'completed',
              downloadUrl: result.downloadUrl
            })

            resolve(result.downloadUrl)
          } catch (error) {
            onProgress({
              fileId: session.fileId,
              fileName: file.name,
              progress: 0,
              status: 'error',
              error: error instanceof Error ? error.message : 'Upload completion failed'
            })
            reject(error)
          }
        } else {
          const error = `Upload failed with status: ${xhr.status}`
          onProgress({
            fileId: session.fileId,
            fileName: file.name,
            progress: 0,
            status: 'error',
            error
          })
          reject(new Error(error))
        }
      })

      xhr.addEventListener('error', () => {
        const error = 'Upload failed due to network error'
        onProgress({
          fileId: session.fileId,
          fileName: file.name,
          progress: 0,
          status: 'error',
          error
        })
        reject(new Error(error))
      })

      xhr.open('POST', session.uploadUrl)
      xhr.send(formData)
    })

  } catch (error) {
    onProgress({
      fileId: '',
      fileName: file.name,
      progress: 0,
      status: 'error',
      error: error instanceof Error ? error.message : 'Upload failed'
    })
    throw error
  }
}

/**
 * Validate video file
 */
export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  // Check file size (5GB limit)
  const maxSize = 5 * 1024 * 1024 * 1024 // 5GB in bytes
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 5GB limit'
    }
  }

  // Check file type
  const allowedTypes = [
    'video/mp4',
    'video/quicktime', // .mov
    'video/x-msvideo', // .avi
    'video/x-matroska', // .mkv
    'video/webm'
  ]

  const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm']
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))

  if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: 'File type not supported. Please upload MP4, MOV, AVI, MKV, or WebM files.'
    }
  }

  return { valid: true }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Format upload duration
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return `${minutes}m ${remainingSeconds}s`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
}
