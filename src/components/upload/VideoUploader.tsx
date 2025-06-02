import { useEffect, useRef, useState, useContext } from 'react'
import Uppy from '@uppy/core'
import DragDrop from '@uppy/drag-drop'
import XHRUpload from '@uppy/xhr-upload'
import { AuthContext, type AuthContextType } from '../auth/AuthProvider'

interface UploadedFile {
  id: string
  name: string
  size: number
  progress: number
  status: 'uploading' | 'success' | 'error'
  error?: string
  url?: string
}

export default function VideoUploader() {
  const authContext = useContext(AuthContext) as AuthContextType | undefined
  const user = authContext?.user || null
  const uppyRef = useRef<Uppy | null>(null)
  const dragDropRef = useRef<HTMLDivElement>(null)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  useEffect(() => {
    if (!dragDropRef.current) return

    // Initialize Uppy
    const uppy = new Uppy({
      restrictions: {
        maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB
        allowedFileTypes: ['video/*'],
        maxNumberOfFiles: 10
      },
      autoProceed: false
    })

    // Add DragDrop plugin
    uppy.use(DragDrop, {
      target: dragDropRef.current,
      note: 'Videos only, up to 5GB each, max 10 files'
    })

    // Add XHRUpload plugin
    uppy.use(XHRUpload, {
      endpoint: '/api/upload/signed-url',
      method: 'POST',
      formData: true,
      fieldName: 'file',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
      },
      getResponseData: (xhr: XMLHttpRequest) => {
        try {
          return JSON.parse(xhr.responseText)
        } catch {
          return {}
        }
      }
    })

    // Event listeners
    uppy.on('file-added', (file) => {
      setFiles(prev => [...prev, {
        id: file.id,
        name: file.name || 'Unknown',
        size: file.size || 0,
        progress: 0,
        status: 'uploading' as const
      }])
    })

    uppy.on('upload-progress', (file, progress) => {
      if (file && progress.bytesTotal && progress.bytesTotal > 0) {
        const percentage = Math.round((progress.bytesUploaded / progress.bytesTotal) * 100)
        setFiles(prev => prev.map(f =>
          f.id === file.id
            ? { ...f, progress: percentage }
            : f
        ))
      }
    })

    uppy.on('upload-success', (file, response) => {
      setFiles(prev => prev.map(f =>
        f.id === file?.id
          ? { ...f, status: 'success' as const, progress: 100, url: response.body?.url }
          : f
      ))
    })

    uppy.on('upload-error', (file, error) => {
      setFiles(prev => prev.map(f =>
        f.id === file?.id
          ? { ...f, status: 'error' as const, error: error.message }
          : f
      ))
    })

    // Note: These events might not be available in the current Uppy version
    // We'll handle drag state through the DragDrop plugin's built-in styling

    uppyRef.current = uppy

    return () => {
      uppy.destroy()
    }
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const removeFile = (fileId: string) => {
    if (uppyRef.current) {
      uppyRef.current.removeFile(fileId)
    }
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const startUpload = () => {
    if (uppyRef.current) {
      uppyRef.current.upload()
    }
  }

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status === 'uploading'))
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Drag & Drop Zone */}
      <div
        ref={dragDropRef}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <div className="flex flex-col items-center gap-4">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <div>
            <p className="text-lg font-medium text-gray-900">Drop video files here</p>
            <p className="text-sm text-gray-500">or click to browse</p>
          </div>
          <div className="text-xs text-gray-400">
            <p>Supports: MP4, MOV, AVI, MKV, WebM</p>
            <p>Max size: 5GB per file • Max files: 10</p>
          </div>
        </div>
      </div>

      {/* Upload Controls */}
      {files.length > 0 && (
        <div className="mt-6 flex gap-4">
          <button
            onClick={startUpload}
            disabled={files.every(f => f.status !== 'uploading' || f.progress > 0)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Upload
          </button>
          <button
            onClick={clearCompleted}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Clear Completed
          </button>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-lg font-medium text-gray-900">Upload Queue</h3>
          {files.map((file) => (
            <div key={file.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    file.status === 'success' ? 'bg-green-100 text-green-800' :
                    file.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {file.status === 'success' ? 'Complete' :
                     file.status === 'error' ? 'Failed' :
                     'Uploading'}
                  </span>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    file.status === 'success' ? 'bg-green-500' :
                    file.status === 'error' ? 'bg-red-500' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${file.progress}%` }}
                ></div>
              </div>

              {file.error && (
                <p className="text-xs text-red-600 mt-1">{file.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
