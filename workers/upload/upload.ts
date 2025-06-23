/**
 * Cloudflare Worker for Video Upload Management
 * Handles Cloudflare R2 integration and upload coordination
 */

interface Env {
  CLOUDFLARE_ACCOUNT_ID: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_BUCKET_NAME: string
  JWT_SECRET: string
  UPLOAD_KV: any
}

interface R2UploadResponse {
  uploadUrl: string
  fields: Record<string, string>
}

interface UploadSession {
  fileId: string
  fileName: string
  fileSize: number
  uploadUrl: string
  authToken: string
  userId: string
  createdAt: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      // Verify JWT token for all requests
      const user = await verifyAuth(request, env)
      if (!user) {
        return new Response('Unauthorized', {
          status: 401,
          headers: corsHeaders
        })
      }

      if (path === '/upload/init' && request.method === 'POST') {
        return await handleUploadInit(request, env, user, corsHeaders)
      }

      if (path === '/upload/complete' && request.method === 'POST') {
        return await handleUploadComplete(request, env, user, corsHeaders)
      }

      if (path === '/upload/status' && request.method === 'GET') {
        return await handleUploadStatus(request, env, user, corsHeaders)
      }

      if (path === '/uploads' && request.method === 'GET') {
        return await handleListUploads(request, env, user, corsHeaders)
      }

      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders
      })

    } catch (error) {
      console.error('Upload worker error:', error)
      return new Response('Internal Server Error', {
        status: 500,
        headers: corsHeaders
      })
    }
  },
}

async function verifyAuth(request: Request, env: Env): Promise<any> {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  try {
    return await verifyJWT(token, env.JWT_SECRET)
  } catch (error) {
    return null
  }
}

async function handleUploadInit(request: Request, env: Env, user: any, corsHeaders: Record<string, string>): Promise<Response> {
  const { fileName, fileSize, contentType } = await request.json()

  if (!fileName || !fileSize) {
    return new Response('fileName and fileSize required', {
      status: 400,
      headers: corsHeaders
    })
  }

  // Validate file size (5GB limit)
  const maxSize = 5 * 1024 * 1024 * 1024 // 5GB
  if (fileSize > maxSize) {
    return new Response('File size exceeds 5GB limit', {
      status: 400,
      headers: corsHeaders
    })
  }

  // Validate file type
  const allowedTypes = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/webm'
  ]

  if (contentType && !allowedTypes.includes(contentType)) {
    return new Response('Unsupported file type', {
      status: 400,
      headers: corsHeaders
    })
  }

  try {
    // Generate unique file ID and object key
    const fileId = crypto.randomUUID()
    const timestamp = new Date().toISOString()
    const objectKey = `${fileId}_${fileName}`

    // Generate presigned URL for R2 upload
    const uploadUrl = await generateR2PresignedUrl(env, objectKey, contentType)

    // Store upload session in KV
    const session: UploadSession = {
      fileId,
      fileName,
      fileSize,
      uploadUrl,
      authToken: '', // Not needed for R2 presigned URLs
      userId: user.sub,
      createdAt: timestamp,
    }

    await env.UPLOAD_KV.put(`session:${fileId}`, JSON.stringify(session), {
      expirationTtl: 3600, // 1 hour
    })

    return new Response(JSON.stringify({
      fileId,
      fileName,
      fileSize,
      uploadUrl,
      objectKey,
      chunkSize: 5 * 1024 * 1024, // 5MB chunks
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })

  } catch (error) {
    console.error('Upload init error:', error)
    return new Response('Failed to initialize upload', {
      status: 500,
      headers: corsHeaders
    })
  }
}

async function handleUploadComplete(request: Request, env: Env, user: any, corsHeaders: Record<string, string>): Promise<Response> {
  const { fileId, fileName, fileSize } = await request.json()

  if (!fileId) {
    return new Response('fileId required', {
      status: 400,
      headers: corsHeaders
    })
  }

  try {
    // Get session from KV
    const sessionData = await env.UPLOAD_KV.get(`session:${fileId}`)
    if (!sessionData) {
      return new Response('Upload session not found', {
        status: 404,
        headers: corsHeaders
      })
    }

    const session: UploadSession = JSON.parse(sessionData)

    // Verify user owns this upload
    if (session.userId !== user.sub) {
      return new Response('Unauthorized', {
        status: 403,
        headers: corsHeaders
      })
    }

    // Store upload record in KV for user's upload history
    const uploadRecord = {
      fileId,
      fileName: fileName || session.fileName,
      fileSize: fileSize || session.fileSize,
      uploadedAt: new Date().toISOString(),
      userId: user.sub,
      status: 'completed',
    }

    await env.UPLOAD_KV.put(`upload:${user.sub}:${fileId}`, JSON.stringify(uploadRecord))

    // Add to user's upload list
    const userUploadsKey = `uploads:${user.sub}`
    const existingUploads = await env.UPLOAD_KV.get(userUploadsKey)
    const uploads = existingUploads ? JSON.parse(existingUploads) : []
    uploads.unshift(fileId) // Add to beginning

    // Keep only last 100 uploads
    if (uploads.length > 100) {
      uploads.splice(100)
    }

    await env.UPLOAD_KV.put(userUploadsKey, JSON.stringify(uploads))

    // Clean up session
    await env.UPLOAD_KV.delete(`session:${fileId}`)

    // Generate R2 download URL
    const downloadUrl = `https://${env.R2_BUCKET_NAME}.${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${fileId}_${fileName}`

    return new Response(JSON.stringify({
      fileId,
      fileName,
      fileSize,
      downloadUrl,
      uploadedAt: uploadRecord.uploadedAt,
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })

  } catch (error) {
    console.error('Upload complete error:', error)
    return new Response('Failed to complete upload', {
      status: 500,
      headers: corsHeaders
    })
  }
}

async function handleUploadStatus(request: Request, env: Env, user: any, corsHeaders: Record<string, string>): Promise<Response> {
  const url = new URL(request.url)
  const fileId = url.searchParams.get('fileId')

  if (!fileId) {
    return new Response('fileId required', {
      status: 400,
      headers: corsHeaders
    })
  }

  try {
    // Check if upload is completed
    const uploadRecord = await env.UPLOAD_KV.get(`upload:${user.sub}:${fileId}`)
    if (uploadRecord) {
      return new Response(uploadRecord, {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    // Check if session exists (upload in progress)
    const sessionData = await env.UPLOAD_KV.get(`session:${fileId}`)
    if (sessionData) {
      const session: UploadSession = JSON.parse(sessionData)
      if (session.userId !== user.sub) {
        return new Response('Unauthorized', {
          status: 403,
          headers: corsHeaders
        })
      }

      return new Response(JSON.stringify({
        fileId,
        fileName: session.fileName,
        fileSize: session.fileSize,
        status: 'uploading',
        createdAt: session.createdAt,
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    return new Response('Upload not found', {
      status: 404,
      headers: corsHeaders
    })

  } catch (error) {
    console.error('Upload status error:', error)
    return new Response('Failed to get upload status', {
      status: 500,
      headers: corsHeaders
    })
  }
}

async function handleListUploads(request: Request, env: Env, user: any, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const userUploadsKey = `uploads:${user.sub}`
    const uploadsData = await env.UPLOAD_KV.get(userUploadsKey)

    if (!uploadsData) {
      return new Response(JSON.stringify([]), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    const uploadIds: string[] = JSON.parse(uploadsData)
    const uploads: any[] = []

    // Get details for each upload (limit to first 20)
    for (const fileId of uploadIds.slice(0, 20)) {
      const uploadData = await env.UPLOAD_KV.get(`upload:${user.sub}:${fileId}`)
      if (uploadData) {
        uploads.push(JSON.parse(uploadData))
      }
    }

    return new Response(JSON.stringify(uploads), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })

  } catch (error) {
    console.error('List uploads error:', error)
    return new Response('Failed to list uploads', {
      status: 500,
      headers: corsHeaders
    })
  }
}

// Cloudflare R2 utility functions
async function generateR2PresignedUrl(env: Env, objectKey: string, contentType?: string): Promise<string> {
  const endpoint = `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const region = 'auto'
  const method = 'PUT'

  // Create AWS signature for R2 (S3-compatible)
  const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '')
  const date = timestamp.substr(0, 8)

  const credentialScope = `${date}/${region}/s3/aws4_request`
  const credential = `${env.R2_ACCESS_KEY_ID}/${credentialScope}`

  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': timestamp,
    'X-Amz-Expires': '3600', // 1 hour
    'X-Amz-SignedHeaders': 'host',
  })

  if (contentType) {
    params.set('X-Amz-Content-Type', contentType)
  }

  const canonicalRequest = [
    method,
    `/${env.R2_BUCKET_NAME}/${objectKey}`,
    params.toString(),
    'host:' + `${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    '',
    'host',
    'UNSIGNED-PAYLOAD'
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    credentialScope,
    await sha256(canonicalRequest)
  ].join('\n')

  const signature = await createSignature(env.R2_SECRET_ACCESS_KEY, date, region, 's3', stringToSign)
  params.set('X-Amz-Signature', signature)

  return `${endpoint}/${env.R2_BUCKET_NAME}/${objectKey}?${params.toString()}`
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function createSignature(secretKey: string, date: string, region: string, service: string, stringToSign: string): Promise<string> {
  const kDate = await hmac(`AWS4${secretKey}`, date)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, service)
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = await hmac(kSigning, stringToSign)

  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmac(key: string | ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
}

// JWT utility function (same as auth worker)
async function verifyJWT(token: string, secret: string): Promise<any> {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid token format')
  }

  const [header, payload, signature] = parts
  const data = `${header}.${payload}`

  const expectedSignature = await sign(data, secret)
  if (signature !== expectedSignature) {
    throw new Error('Invalid signature')
  }

  const decodedPayload = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))

  if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }

  return decodedPayload
}

async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}
