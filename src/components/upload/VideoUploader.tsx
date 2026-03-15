import Uppy from "@uppy/core"
import DragDrop from "@uppy/drag-drop"
import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"

const CHUNK_SIZE = 50 * 1024 * 1024
const DIRECT_UPLOAD_LIMIT = 95 * 1024 * 1024
const MAX_CONCURRENT_FILES = 3
const MAX_CONCURRENT_CHUNKS = 4

interface UploadedFile {
  id: string
  name: string
  size: number
  progress: number
  status: "pending" | "uploading" | "finalizing" | "success" | "error"
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

async function runPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
}

// Direct upload: presign -> PUT to R2 -> confirm with worker
async function uploadDirect(
  file: File,
  onProgress: (pct: number) => void,
  onFinalizing?: () => void,
): Promise<string> {
  // 1. Get presigned URL from worker
  const presignRes = await fetch("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
    }),
  })

  if (!presignRes.ok) throw new Error("Failed to get presigned URL")
  const { fileId, objectKey, uploadUrl } = (await presignRes.json()) as {
    fileId: string
    objectKey: string
    uploadUrl: string
  }

  // 2. PUT directly to R2 via presigned URL
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", uploadUrl)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`R2 upload failed: ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error("Network error uploading to R2"))
    xhr.send(file)
  })

  // 3. Confirm with worker (records in D1)
  onFinalizing?.()
  const confirmRes = await fetch("/api/upload/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileId,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || "application/octet-stream",
      objectKey,
    }),
  })

  if (!confirmRes.ok) throw new Error("Failed to confirm upload")
  return fileId
}

// Multipart: get presigned part URLs -> PUT chunks to R2 in parallel -> complete
async function uploadMultipart(
  file: File,
  onProgress: (pct: number) => void,
  onFinalizing?: () => void,
): Promise<string> {
  // 1. Init multipart - worker returns presigned URLs for all parts
  const initRes = await fetch("/api/upload/multipart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      fileSize: file.size,
    }),
  })

  if (!initRes.ok) throw new Error("Failed to init multipart upload")
  const { fileId, parts: partUrls } = (await initRes.json()) as {
    fileId: string
    parts: { partNumber: number; url: string }[]
  }

  // 2. Upload chunks directly to R2 in parallel
  let uploadedBytes = 0

  await runPool(partUrls, MAX_CONCURRENT_CHUNKS, async ({ partNumber, url }) => {
    const start = (partNumber - 1) * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    const partRes = await fetch(url, {
      method: "PUT",
      body: chunk,
    })

    if (!partRes.ok) throw new Error(`Failed to upload part ${partNumber}`)

    uploadedBytes += end - start
    onProgress(Math.round((uploadedBytes / file.size) * 100))
  })

  // 3. Complete - worker fetches ETags via S3 ListParts + finalizes + records in D1
  onFinalizing?.()
  const completeRes = await fetch("/api/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId }),
  })

  if (!completeRes.ok) throw new Error("Failed to complete multipart upload")
  return fileId
}

function statusBadge(status: UploadedFile["status"], progress: number) {
  switch (status) {
    case "success":
      return <Badge className="bg-green-500/20 text-green-300 border-green-500/30">Done</Badge>
    case "error":
      return <Badge variant="destructive">Failed</Badge>
    case "finalizing":
      return (
        <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 animate-pulse">
          Finalizing...
        </Badge>
      )
    case "uploading":
      return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">{progress}%</Badge>
    default:
      return <Badge variant="secondary">Ready</Badge>
  }
}

function CompletionScreen({ files, onReset }: { files: UploadedFile[]; onReset: () => void }) {
  const succeeded = files.filter((f) => f.status === "success")
  const failed = files.filter((f) => f.status === "error")
  const totalSize = succeeded.reduce((acc, f) => acc + f.size, 0)

  const stagger = (delay: number) =>
    ({
      opacity: 0,
      animation: `fade-up 0.5s ease-out ${delay}ms both`,
    }) as const

  return (
    <>
      <style>{`
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes zoom-check {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes draw-check {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
      <div className="w-full">
        {/* Big checkmark */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="relative mb-6"
            style={{ opacity: 0, animation: "zoom-check 0.5s ease-out 100ms both" }}
          >
            <div className="w-24 h-24 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                  style={{
                    strokeDasharray: 24,
                    strokeDashoffset: 24,
                    animation: "draw-check 0.4s ease-out 400ms both",
                  }}
                />
              </svg>
            </div>
            {/* Glow ring */}
            <div className="absolute inset-0 w-24 h-24 rounded-full bg-green-500/10 blur-xl -z-10" />
          </div>

          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-2" style={stagger(200)}>
            <span className="text-green-400">Upload</span>{" "}
            <span className="text-foreground">Complete</span>
          </h2>
          <p className="text-muted-foreground text-lg" style={stagger(300)}>
            {succeeded.length} file{succeeded.length !== 1 ? "s" : ""} delivered to the sky
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8" style={stagger(400)}>
          <Card className="bg-card/30 backdrop-blur-sm border-border/50 text-center">
            <CardContent className="py-4">
              <p className="text-2xl font-black text-primary">{succeeded.length}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Uploaded</p>
            </CardContent>
          </Card>
          <Card className="bg-card/30 backdrop-blur-sm border-border/50 text-center">
            <CardContent className="py-4">
              <p className="text-2xl font-black text-foreground">{formatFileSize(totalSize)}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Size</p>
            </CardContent>
          </Card>
          <Card className="bg-card/30 backdrop-blur-sm border-border/50 text-center">
            <CardContent className="py-4">
              <p className="text-2xl font-black text-foreground">
                {failed.length > 0 ? failed.length : "-"}
              </p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {failed.length > 0 ? "Failed" : "Errors"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* File list summary */}
        <Card className="bg-card/30 backdrop-blur-sm border-border/50 mb-8" style={stagger(500)}>
          <CardContent className="p-0">
            {files.map((file, i) => (
              <div key={file.id}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${file.status === "success" ? "bg-green-400" : "bg-red-400"}`}
                    />
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                    {file.status === "success" ? (
                      <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                        Done
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Failed</Badge>
                    )}
                  </div>
                </div>
                {file.error && (
                  <p className="px-4 pb-3 text-xs text-red-400 font-mono break-all">{file.error}</p>
                )}
                {i < files.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Reset button */}
        <div className="flex justify-center" style={stagger(650)}>
          <Button onClick={onReset} size="lg" className="text-lg px-8 py-6 h-auto font-bold">
            Upload More Files
          </Button>
        </div>
      </div>
    </>
  )
}

export default function VideoUploader() {
  const dragDropRef = useRef<HTMLDivElement>(null)
  const uppyRef = useRef<Uppy | null>(null)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [phase, setPhase] = useState<"upload" | "transitioning" | "complete">("upload")

  useEffect(() => {
    if (phase !== "upload" || !dragDropRef.current) return

    const uppy = new Uppy({
      restrictions: {
        maxFileSize: 5 * 1024 * 1024 * 1024,
        allowedFileTypes: ["video/*"],
        maxNumberOfFiles: 10,
      },
      autoProceed: false,
    })

    uppy.use(DragDrop, {
      target: dragDropRef.current,
      note: "Videos only, up to 5GB each",
    })

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
      // Only remove from UI if still pending (user manually removed it)
      // Don't remove completed/failed files - we need them for the completion screen
      setFiles((prev) => prev.filter((f) => f.id !== file.id || f.status !== "pending"))
    })

    uppyRef.current = uppy

    return () => {
      uppy.destroy()
      uppyRef.current = null
    }
  }, [phase])

  function updateFile(id: string, updates: Partial<UploadedFile>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)))
  }

  async function startUpload() {
    const uppy = uppyRef.current
    if (!uppy) return

    const uppyFiles = uppy.getFiles()

    await runPool(uppyFiles, MAX_CONCURRENT_FILES, async (uppyFile) => {
      const file = uppyFile.data as File
      const id = uppyFile.id

      updateFile(id, { status: "uploading", progress: 0 })

      try {
        const useMultipart = file.size > DIRECT_UPLOAD_LIMIT
        const onFinalizing = () => updateFile(id, { status: "finalizing", progress: 100 })
        const fileId = useMultipart
          ? await uploadMultipart(file, (pct) => updateFile(id, { progress: pct }), onFinalizing)
          : await uploadDirect(file, (pct) => updateFile(id, { progress: pct }), onFinalizing)

        updateFile(id, { status: "success", progress: 100, fileId })
        uppy.removeFile(id)
      } catch (err) {
        const msg =
          err instanceof Error
            ? `${err.message}${err.stack ? ` | ${err.stack.split("\n").slice(0, 3).join(" ")}` : ""}`
            : String(err)
        updateFile(id, { status: "error", error: msg })
      }
    })

    // All uploads done - transition to completion screen
    setFiles((prev) => {
      const allDone =
        prev.length > 0 && prev.every((f) => f.status === "success" || f.status === "error")
      if (allDone && prev.length > 0) {
        setPhase("transitioning")
        setTimeout(() => setPhase("complete"), 400)
      }
      return prev
    })
  }

  function removeFile(id: string) {
    uppyRef.current?.removeFile(id)
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  function clearCompleted() {
    setFiles((prev) => prev.filter((f) => f.status !== "success" && f.status !== "error"))
  }

  function resetUploader() {
    setFiles([])
    setPhase("upload")
  }

  const pendingFiles = files.filter((f) => f.status === "pending")
  const hasFiles = files.length > 0

  // Completion screen
  if (phase === "complete") {
    return <CompletionScreen files={files} onReset={resetUploader} />
  }

  // Transition out - fade the upload UI
  const transitionClass =
    phase === "transitioning" ? "animate-out fade-out slide-out-to-top-4 duration-400" : ""

  return (
    <div className={`w-full ${transitionClass}`}>
      <Card className="bg-card/30 backdrop-blur-sm border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <div ref={dragDropRef} className="rounded-xl overflow-hidden" />
        </CardContent>
      </Card>

      {hasFiles && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              {files.length} file{files.length > 1 ? "s" : ""}
            </h3>
            <div className="flex gap-3">
              {pendingFiles.length > 0 && (
                <Button onClick={startUpload}>
                  Upload {pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""}
                </Button>
              )}
              <Button variant="secondary" onClick={clearCompleted}>
                Clear
              </Button>
            </div>
          </div>

          {files.map((file) => (
            <Card key={file.id} className="bg-card/30 backdrop-blur-sm border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(file.status, file.progress)}
                    {file.status !== "uploading" && file.status !== "finalizing" && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeFile(file.id)}
                        className="text-muted-foreground hover:text-destructive"
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
                      </Button>
                    )}
                  </div>
                </div>

                {(file.status === "uploading" ||
                  file.status === "finalizing" ||
                  file.status === "success") && (
                  <Progress
                    value={file.progress}
                    className={
                      file.status === "success"
                        ? "[&>[data-slot=progress-indicator]]:bg-green-500"
                        : file.status === "finalizing"
                          ? "[&>[data-slot=progress-indicator]]:bg-yellow-500 [&>[data-slot=progress-indicator]]:animate-pulse"
                          : "[&>[data-slot=progress-indicator]]:bg-primary"
                    }
                  />
                )}

                {file.error && <p className="text-xs text-destructive mt-1">{file.error}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
