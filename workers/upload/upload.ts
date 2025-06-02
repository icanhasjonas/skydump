/**
 * Cloudflare Worker for Video Upload Management
 * Handles B2 Backblaze integration and upload coordination
 */

interface Env {
  B2_APPLICATION_KEY_ID: string
  B2_APPLICATION_KEY: string
  B2_BUCKET_ID: string
  B2_BUCKET_NAME: string
  JWT_SECRET: string
  UPLOAD_KV: any
}

interface B2AuthResponse {
  authorizationToken: string
  apiUrl: string
  downloadUrl: string
}

interface B2UploadUrlResponse {
  bucketId: string
  uploadUrl: string
  authorizationToken: string
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
    // Authenticate with B2
    const b2Auth = await authenticateB2(env)

    // Get upload URL from B2
    const uploadUrlResponse = await getB2UploadUrl(b2Auth, env)

    // Generate unique file ID
    const fileId = crypto.randomUUID()
    const timestamp = new Date().toISOString()

    // Store upload session in KV
    const session: UploadSession = {
      fileId,
      fileName,
      fileSize,
      uploadUrl: uploadUrlResponse.uploadUrl,
      authToken: uploadUrlResponse.authorizationToken,
      userId: user.sub,
      createdAt: timestamp,
    }

    await env.UPLOAD_KV.put(`session:${fileId}`, JSON.stringify(session), {
      expirationTtl: 3600, // 1 hour
    })

    // Create a proxy upload URL that goes through our worker
    const proxyUploadUrl = `${new URL(request.url).origin}/upload/proxy/${fileId}`

    return new Response(JSON.stringify({
      fileId,
      fileName,
      fileSize,
      uploadUrl: proxyUploadUrl,
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

    // Generate download URL (B2 file URL)
    const b2Auth = await authenticateB2(env)
    const downloadUrl = `${b2Auth.downloadUrl}/file/${env.B2_BUCKET_NAME}/${fileId}_${fileName}`

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

// B2 Backblaze utility functions
async function authenticateB2(env: Env): Promise<B2AuthResponse> {
  const credentials = btoa(`${env.B2_APPLICATION_KEY_ID}:${env.B2_APPLICATION_KEY}`)

  const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
    },
  })

  if (!response.ok) {
    throw new Error('B2 authentication failed')
  }

  return await response.json()
}

async function getB2UploadUrl(b2Auth: B2AuthResponse, env: Env): Promise<B2UploadUrlResponse> {
  const response = await fetch(`${b2Auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: {
      'Authorization': b2Auth.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bucketId: env.B2_BUCKET_ID,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to get B2 upload URL')
  }

  return await response.json()
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
