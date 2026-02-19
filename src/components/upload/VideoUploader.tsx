import Uppy from "@uppy/core"
import DragDrop from "@uppy/drag-drop"
import ProgressBar from "@uppy/progress-bar"
import { useEffect, useRef, useState } from "react"

const CHUNK_SIZE = 50 * 1024 * 1024 // 50MB chunks for multipart
const DIRECT_UPLOAD_LIMIT = 95 * 1024 * 1024 // ~95MB - use direct upload below this

interface UploadedFile {
  id: string
  name: string
  size: number
  progress: number
  status: "pending" | "uploading" | "success" | "error"
  error?: string
  fileId?: string
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

async function uploadDirect(file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/upload")
    xhr.setRequestHeader("x-file-name", file.name)
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText)
        resolve(data.fileId)
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
      }
    }

    xhr.onerror = () => reject(new Error("Network error"))
    xhr.send(file)
  })
}

async function uploadMultipart(file: File, onProgress: (pct: number) => void): Promise<string> {
  // 1. Init multipart
  const initRes = await fetch("/api/upload/multipart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
    }),
  })

  if (!initRes.ok) throw new Error("Failed to init multipart upload")
  const { fileId } = await initRes.json()

  // 2. Upload parts
  const totalParts = Math.ceil(file.size / CHUNK_SIZE)
  let uploadedBytes = 0

  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    const start = (partNumber - 1) * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    const partRes = await fetch(`/api/upload/part?fileId=${fileId}&partNumber=${partNumber}`, {
      method: "PUT",
      body: chunk,
    })

    if (!partRes.ok) throw new Error(`Failed to upload part ${partNumber}`)

    uploadedBytes += end - start
    onProgress(Math.round((uploadedBytes / file.size) * 100))
  }

  // 3. Complete
  const completeRes = await fetch("/api/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId }),
  })

  if (!completeRes.ok) throw new Error("Failed to complete multipart upload")
  return fileId
}

export default function VideoUploader() {
  const dragDropRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const uppyRef = useRef<Uppy | null>(null)
  const [files, setFiles] = useState<UploadedFile[]>([])

  useEffect(() => {
    if (!dragDropRef.current) return

    const uppy = new Uppy({
      restrictions: {
        maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB
        allowedFileTypes: ["video/*"],
        maxNumberOfFiles: 10,
      },
      autoProceed: false,
    })

    uppy.use(DragDrop, {
      target: dragDropRef.current,
      note: "Videos only, up to 5GB each",
    })

    if (progressRef.current) {
      uppy.use(ProgressBar, {
        target: progressRef.current,
        hideAfterFinish: false,
      })
    }

    uppy.on("file-added", (file) => {
      setFiles((prev) => [
        ...prev,
        {
          id: file.id,
          name: file.name || "Unknown",
          size: file.size || 0,
          progress: 0,
          status: "pending",
        },
      ])
    })

    uppy.on("file-removed", (file) => {
      setFiles((prev) => prev.filter((f) => f.id !== file.id))
    })

    uppyRef.current = uppy

    return () => {
      uppy.destroy()
    }
  }, [])

  function updateFile(id: string, updates: Partial<UploadedFile>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)))
  }

  async function startUpload() {
    const uppy = uppyRef.current
    if (!uppy) return

    const uppyFiles = uppy.getFiles()

    for (const uppyFile of uppyFiles) {
      const file = uppyFile.data as File
      const id = uppyFile.id

      updateFile(id, { status: "uploading", progress: 0 })

      try {
        const useMultipart = file.size > DIRECT_UPLOAD_LIMIT
        const fileId = useMultipart
          ? await uploadMultipart(file, (pct) => updateFile(id, { progress: pct }))
          : await uploadDirect(file, (pct) => updateFile(id, { progress: pct }))

        updateFile(id, { status: "success", progress: 100, fileId })
        uppy.removeFile(id)
      } catch (err) {
        updateFile(id, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        })
      }
    }
  }

  function removeFile(id: string) {
    uppyRef.current?.removeFile(id)
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  function clearCompleted() {
    setFiles((prev) => prev.filter((f) => f.status !== "success" && f.status !== "error"))
  }

  const pendingFiles = files.filter((f) => f.status === "pending")
  const hasFiles = files.length > 0

  return (
    <div className="w-full">
      {/* Drop zone */}
      <div ref={dragDropRef} className="rounded-xl overflow-hidden" />
      <div ref={progressRef} />

      {/* File list */}
      {hasFiles && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              {files.length} file{files.length > 1 ? "s" : ""}
            </h3>
            <div className="flex gap-3">
              {pendingFiles.length > 0 && (
                <button
                  type="button"
                  onClick={startUpload}
                  className="px-5 py-2 bg-yellow-400 text-gray-900 font-bold rounded-lg hover:bg-yellow-300 transition-colors"
                >
                  Upload {pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""}
                </button>
              )}
              <button
                type="button"
                onClick={clearCompleted}
                className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {files.map((file) => (
            <div
              key={file.id}
              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{file.name}</p>
                  <p className="text-xs text-blue-200">{formatFileSize(file.size)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      file.status === "success"
                        ? "bg-green-500/20 text-green-200"
                        : file.status === "error"
                          ? "bg-red-500/20 text-red-200"
                          : file.status === "uploading"
                            ? "bg-blue-500/20 text-blue-200"
                            : "bg-white/10 text-white/70"
                    }`}
                  >
                    {file.status === "success"
                      ? "Done"
                      : file.status === "error"
                        ? "Failed"
                        : file.status === "uploading"
                          ? `${file.progress}%`
                          : "Ready"}
                  </span>
                  {file.status !== "uploading" && (
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      className="text-white/50 hover:text-red-300 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-label="Remove file"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {(file.status === "uploading" || file.status === "success") && (
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      file.status === "success" ? "bg-green-400" : "bg-yellow-400"
                    }`}
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              )}

              {file.error && <p className="text-xs text-red-300 mt-1">{file.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
