/**
 * Cloudflare Worker for Email Notifications
 * Sends email notifications to admin when uploads complete
 */

import { EmailMessage } from 'cloudflare:email'
import { createMimeMessage } from 'mimetext'

interface Env {
  FROM_EMAIL: string
  JWT_SECRET: string
  ADMIN_EMAIL: any // Cloudflare Email binding
}

interface EmailRequest {
  to: string
  subject: string
  fileName: string
  fileSize: number
  downloadUrl?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      if (path === '/email/upload-complete' && request.method === 'POST') {
        return await handleUploadCompleteEmail(request, env, corsHeaders)
      }

      if (path === '/email/upload-failed' && request.method === 'POST') {
        return await handleUploadFailedEmail(request, env, corsHeaders)
      }

      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders
      })

    } catch (error) {
      console.error('Email worker error:', error)
      return new Response('Internal Server Error', {
        status: 500,
        headers: corsHeaders
      })
    }
  },
}

async function handleUploadCompleteEmail(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  // Try to get user info, but allow anonymous uploads
  const user = await verifyAuth(request, env)

  const emailData: EmailRequest = await request.json()

  if (!emailData.fileName || !emailData.fileSize) {
    return new Response('fileName and fileSize required', {
      status: 400,
      headers: corsHeaders
    })
  }

  try {
    const emailContent = generateUploadCompleteAdminEmail(emailData, user)

    await sendAdminEmail({
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    }, env)

    return new Response(JSON.stringify({
      success: true,
      message: 'Admin notification sent successfully',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })

  } catch (error) {
    console.error('Failed to send admin notification:', error)
    return new Response('Failed to send admin notification', {
      status: 500,
      headers: corsHeaders
    })
  }
}

async function handleUploadFailedEmail(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  // Try to get user info, but allow anonymous uploads
  const user = await verifyAuth(request, env)

  const emailData: EmailRequest & { error?: string } = await request.json()

  if (!emailData.fileName) {
    return new Response('fileName required', {
      status: 400,
      headers: corsHeaders
    })
  }

  try {
    const emailContent = generateUploadFailedAdminEmail(emailData, user)

    await sendAdminEmail({
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    }, env)

    return new Response(JSON.stringify({
      success: true,
      message: 'Admin notification sent successfully',
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })

  } catch (error) {
    console.error('Failed to send admin notification:', error)
    return new Response('Failed to send admin notification', {
      status: 500,
      headers: corsHeaders
    })
  }
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

function generateUploadCompleteAdminEmail(emailData: EmailRequest, user: any) {
  const fileSizeFormatted = formatFileSize(emailData.fileSize)
  const userInfo = user ? `${user.name} (${user.email})` : 'Anonymous User'

  const subject = `🎉 SKY DUMP: New Upload Complete - ${emailData.fileName}`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Upload Complete</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 2rem; text-align: center; }
        .content { padding: 2rem; }
        .success-icon { font-size: 3rem; margin-bottom: 1rem; }
        .file-info { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
        .user-info { background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; margin: 1rem 0; }
        .footer { background-color: #f8fafc; padding: 1rem; text-align: center; color: #6b7280; font-size: 0.875rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="success-icon">🎉</div>
          <h1>New Upload Complete!</h1>
          <p>A video has been successfully uploaded to SKY DUMP</p>
        </div>

        <div class="content">
          <p>Hi Admin,</p>

          <p>A new video upload has completed successfully on SKY DUMP.</p>

          <div class="user-info">
            <h3>👤 User Information</h3>
            <p><strong>User:</strong> ${userInfo}</p>
            <p><strong>Upload Time:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <div class="file-info">
            <h3>📁 File Details</h3>
            <p><strong>File Name:</strong> ${emailData.fileName}</p>
            <p><strong>File Size:</strong> ${fileSizeFormatted}</p>
            ${emailData.downloadUrl ? `<p><strong>Download URL:</strong> <a href="${emailData.downloadUrl}">View File</a></p>` : ''}
          </div>

          <p>The file has been securely stored and is ready for use.</p>

          <a href="https://sky-dump.pages.dev/dashboard" class="button">View Dashboard</a>
        </div>

        <div class="footer">
          <p>This is an automated notification from SKY DUMP Admin System</p>
          <p>Secure Video Upload Service</p>
        </div>
      </div>
    </body>
    </html>
  `

  const text = `
    New Upload Complete!

    Hi Admin,

    A new video upload has completed successfully on SKY DUMP.

    User Information:
    - User: ${userInfo}
    - Upload Time: ${new Date().toLocaleString()}

    File Details:
    - File Name: ${emailData.fileName}
    - File Size: ${fileSizeFormatted}
    ${emailData.downloadUrl ? `- Download URL: ${emailData.downloadUrl}` : ''}

    Dashboard: https://sky-dump.pages.dev/dashboard

    This is an automated notification from SKY DUMP Admin System
  `

  return { subject, html, text }
}

function generateUploadFailedAdminEmail(emailData: EmailRequest & { error?: string }, user: any) {
  const userInfo = user ? `${user.name} (${user.email})` : 'Anonymous User'
  const subject = `⚠️ SKY DUMP: Upload Failed - ${emailData.fileName}`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Upload Failed</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; padding: 2rem; text-align: center; }
        .content { padding: 2rem; }
        .error-icon { font-size: 3rem; margin-bottom: 1rem; }
        .file-info { background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
        .user-info { background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
        .error-info { background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
        .button { display: inline-block; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; margin: 1rem 0; }
        .footer { background-color: #f8fafc; padding: 1rem; text-align: center; color: #6b7280; font-size: 0.875rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="error-icon">⚠️</div>
          <h1>Upload Failed</h1>
          <p>A video upload attempt has failed on SKY DUMP</p>
        </div>

        <div class="content">
          <p>Hi Admin,</p>

          <p>An upload attempt has failed on SKY DUMP. This may require attention.</p>

          <div class="user-info">
            <h3>👤 User Information</h3>
            <p><strong>User:</strong> ${userInfo}</p>
            <p><strong>Attempt Time:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <div class="file-info">
            <h3>📁 File Details</h3>
            <p><strong>File Name:</strong> ${emailData.fileName}</p>
            ${emailData.fileSize ? `<p><strong>File Size:</strong> ${formatFileSize(emailData.fileSize)}</p>` : ''}
          </div>

          ${emailData.error ? `
            <div class="error-info">
              <h3>🚨 Error Details</h3>
              <p><strong>Error:</strong> ${emailData.error}</p>
            </div>
          ` : ''}

          <p><strong>Possible causes:</strong></p>
          <ul>
            <li>Network connectivity issues</li>
            <li>File size exceeding limits (5GB max)</li>
            <li>Unsupported file format</li>
            <li>Storage quota exceeded</li>
            <li>Server-side processing error</li>
          </ul>

          <a href="https://sky-dump.pages.dev/dashboard" class="button">View Dashboard</a>
        </div>

        <div class="footer">
          <p>This is an automated notification from SKY DUMP Admin System</p>
          <p>Monitor upload failures and system health</p>
        </div>
      </div>
    </body>
    </html>
  `

  const text = `
    Upload Failed

    Hi Admin,

    An upload attempt has failed on SKY DUMP.

    User Information:
    - User: ${userInfo}
    - Attempt Time: ${new Date().toLocaleString()}

    File Details:
    - File Name: ${emailData.fileName}
    ${emailData.fileSize ? `- File Size: ${formatFileSize(emailData.fileSize)}` : ''}

    ${emailData.error ? `Error Details: ${emailData.error}` : ''}

    Possible causes:
    - Network connectivity issues
    - File size exceeding limits (5GB max)
    - Unsupported file format
    - Storage quota exceeded
    - Server-side processing error

    Dashboard: https://sky-dump.pages.dev/dashboard

    This is an automated notification from SKY DUMP Admin System
  `

  return { subject, html, text }
}

async function sendAdminEmail(emailData: { subject: string; html: string; text: string }, env: Env) {
  // Create MIME message using mimetext
  const msg = createMimeMessage()

  // Set sender (from verified email address)
  msg.setSender({
    name: 'SKY DUMP System',
    addr: env.FROM_EMAIL
  })

  // Set recipient (admin email from binding - will use destination_address from wrangler.toml)
  msg.setRecipient('admin@sky-dump.pages.dev')

  // Set subject
  msg.setSubject(emailData.subject)

  // Add plain text content
  msg.addMessage({
    contentType: 'text/plain',
    data: emailData.text
  })

  // Add HTML content
  msg.addMessage({
    contentType: 'text/html',
    data: emailData.html
  })

  // Create EmailMessage using Cloudflare's native email API
  const message = new EmailMessage(
    env.FROM_EMAIL,
    'admin@sky-dump.pages.dev',
    msg.asRaw()
  )

  try {
    // Send email using the ADMIN_EMAIL binding
    await env.ADMIN_EMAIL.send(message)
    return { success: true }
  } catch (error) {
    console.error('Failed to send admin email:', error)
    throw new Error(`Admin email sending failed: ${error.message}`)
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// JWT utility function (same as other workers)
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
