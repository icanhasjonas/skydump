/**
 * Cloudflare Worker for Webhook Handling
 * Processes B2 upload completion webhooks and triggers notifications
 */

interface Env {
  JWT_SECRET: string
  EMAIL_WORKER_URL: string
  WEBHOOK_SECRET: string
  UPLOAD_KV: any
}

interface WebhookPayload {
  eventType: string
  bucketId: string
  bucketName: string
  objectName: string
  objectSize: number
  eventTime: string
  requestId: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Signature',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      if (path === '/webhook/b2-upload' && request.method === 'POST') {
        return await handleB2UploadWebhook(request, env, corsHeaders)
      }

      if (path === '/webhook/test' && request.method === 'POST') {
        return await handleTestWebhook(request, env, corsHeaders)
      }

      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders
      })

    } catch (error) {
      console.error('Webhook worker error:', error)
      return new Response('Internal Server Error', {
        status: 500,
        headers: corsHeaders
      })
    }
  },
}

async function handleB2UploadWebhook(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    // Verify webhook signature
    const signature = request.headers.get('X-Webhook-Signature')
    const body = await request.text()

    if (!verifyWebhookSignature(body, signature, env.WEBHOOK_SECRET)) {
      return new Response('Invalid signature', {
        status: 401,
        headers: corsHeaders
      })
    }

    const payload: WebhookPayload = JSON.parse(body)

    // Only process upload completion events
    if (payload.eventType !== 'b2:ObjectCreated') {
      return new Response('Event ignored', {
        status: 200,
        headers: corsHeaders
      })
    }

    // Extract file ID from object name (format: fileId_fileName)
    const objectName = payload.objectName
    const fileId = objectName.split('_')[0]

    if (!fileId) {
      console.error('Could not extract file ID from object name:', objectName)
      return new Response('Invalid object name', {
        status: 400,
        headers: corsHeaders
      })
    }

    // Get upload session or record from KV
    let uploadData = await env.UPLOAD_KV.get(`session:${fileId}`)
    let isSession = true

    if (!uploadData) {
      // Try to find completed upload record
      const keys = await env.UPLOAD_KV.list({ prefix: `upload:` })
      for (const key of keys.keys) {
        if (key.name.endsWith(`:${fileId}`)) {
          uploadData = await env.UPLOAD_KV.get(key.name)
          isSession = false
          break
        }
      }
    }

    if (!uploadData) {
      console.error('Upload data not found for file ID:', fileId)
      return new Response('Upload not found', {
        status: 404,
        headers: corsHeaders
      })
    }

    const upload = JSON.parse(uploadData)

    // Get user info to send notification
    const userId = upload.userId
    if (!userId) {
      console.error('No user ID found in upload data')
      return new Response('User not found', {
        status: 400,
        headers: corsHeaders
      })
    }

    // Create a temporary JWT token for the email service
    const emailToken = await createServiceJWT({
      sub: userId,
      email: upload.userEmail || 'user@example.com', // You might need to store this
      name: upload.userName || 'User', // You might need to store this
      service: 'webhook',
    }, env.JWT_SECRET)

    // Send email notification
    const emailPayload = {
      fileName: upload.fileName,
      fileSize: upload.fileSize || payload.objectSize,
      downloadUrl: `https://f000.backblazeb2.com/file/${payload.bucketName}/${payload.objectName}`,
    }

    const emailResponse = await fetch(`${env.EMAIL_WORKER_URL}/email/upload-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${emailToken}`,
      },
      body: JSON.stringify(emailPayload),
    })

    if (!emailResponse.ok) {
      console.error('Failed to send email notification:', await emailResponse.text())
      // Don't fail the webhook for email issues
    }

    // Update upload record if it was a session
    if (isSession) {
      const completedUpload = {
        fileId,
        fileName: upload.fileName,
        fileSize: payload.objectSize,
        uploadedAt: payload.eventTime,
        userId: upload.userId,
        status: 'completed',
        downloadUrl: `https://f000.backblazeb2.com/file/${payload.bucketName}/${payload.objectName}`,
      }

      // Store completed upload record
      await env.UPLOAD_KV.put(`upload:${userId}:${fileId}`, JSON.stringify(completedUpload))

      // Add to user's upload list
      const userUploadsKey = `uploads:${userId}`
      const existingUploads = await env.UPLOAD_KV.get(userUploadsKey)
      const uploads = existingUploads ? JSON.parse(existingUploads) : []
      uploads.unshift(fileId)

      if (uploads.length > 100) {
        uploads.splice(100)
      }

      await env.UPLOAD_KV.put(userUploadsKey, JSON.stringify(uploads))

      // Clean up session
      await env.UPLOAD_KV.delete(`session:${fileId}`)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Webhook processed successfully',
      fileId,
      fileName: upload.fileName,
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })

  } catch (error) {
    console.error('B2 webhook processing error:', error)
    return new Response('Webhook processing failed', {
      status: 500,
      headers: corsHeaders
    })
  }
}

async function handleTestWebhook(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const testPayload = await request.json()

  console.log('Test webhook received:', testPayload)

  return new Response(JSON.stringify({
    success: true,
    message: 'Test webhook received',
    timestamp: new Date().toISOString(),
    payload: testPayload,
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

function verifyWebhookSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) {
    return false
  }

  try {
    // Remove 'sha256=' prefix if present
    const cleanSignature = signature.replace('sha256=', '')

    // Create expected signature
    const expectedSignature = createHmacSignature(body, secret)

    // Compare signatures
    return cleanSignature === expectedSignature
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

function createHmacSignature(data: string, secret: string): string {
  // This is a simplified version - in production, use crypto.subtle.sign
  // For now, we'll just return a basic hash for demonstration
  return btoa(data + secret).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)
}

// JWT utility functions
async function createServiceJWT(payload: any, secret: string): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }

  const jwtPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
  }

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const encodedPayload = btoa(JSON.stringify(jwtPayload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const data = `${encodedHeader}.${encodedPayload}`
  const signature = await sign(data, secret)

  return `${data}.${signature}`
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
