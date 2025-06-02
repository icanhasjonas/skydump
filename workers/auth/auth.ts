/**
 * Cloudflare Worker for Google OAuth Authentication
 * Handles OAuth callback and token exchange
 */

interface Env {
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  GOOGLE_REDIRECT_URI: string
  JWT_SECRET: string
}

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  id_token: string
}

interface GoogleUserInfo {
  id: string
  email: string
  name: string
  picture?: string
  verified_email: boolean
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
      if (path === '/auth/callback' && request.method === 'POST') {
        return await handleAuthCallback(request, env, corsHeaders)
      }

      if (path === '/auth/refresh' && request.method === 'POST') {
        return await handleTokenRefresh(request, env, corsHeaders)
      }

      if (path === '/auth/verify' && request.method === 'GET') {
        return await handleTokenVerification(request, env, corsHeaders)
      }

      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders
      })

    } catch (error) {
      console.error('Auth worker error:', error)
      return new Response('Internal Server Error', {
        status: 500,
        headers: corsHeaders
      })
    }
  },
}

async function handleAuthCallback(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const { code } = await request.json()

  if (!code) {
    return new Response('Authorization code required', {
      status: 400,
      headers: corsHeaders
    })
  }

  // Exchange authorization code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: env.GOOGLE_REDIRECT_URI,
    }),
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    console.error('Token exchange failed:', error)
    return new Response('Token exchange failed', {
      status: 400,
      headers: corsHeaders
    })
  }

  const tokens: GoogleTokenResponse = await tokenResponse.json()

  // Get user info from Google
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  })

  if (!userResponse.ok) {
    return new Response('Failed to get user info', {
      status: 400,
      headers: corsHeaders
    })
  }

  const userInfo: GoogleUserInfo = await userResponse.json()

  // Create JWT token for our app
  const jwtPayload = {
    sub: userInfo.id,
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  }

  const jwtToken = await createJWT(jwtPayload, env.JWT_SECRET)

  return new Response(JSON.stringify({
    access_token: jwtToken,
    refresh_token: tokens.refresh_token,
    expires_in: 24 * 60 * 60, // 24 hours
    token_type: 'Bearer',
    user_info: {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
    },
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

async function handleTokenRefresh(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const { refresh_token } = await request.json()

  if (!refresh_token) {
    return new Response('Refresh token required', {
      status: 400,
      headers: corsHeaders
    })
  }

  // Refresh the Google token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!tokenResponse.ok) {
    return new Response('Token refresh failed', {
      status: 400,
      headers: corsHeaders
    })
  }

  const tokens: GoogleTokenResponse = await tokenResponse.json()

  // Get updated user info
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  })

  if (!userResponse.ok) {
    return new Response('Failed to get user info', {
      status: 400,
      headers: corsHeaders
    })
  }

  const userInfo: GoogleUserInfo = await userResponse.json()

  // Create new JWT token
  const jwtPayload = {
    sub: userInfo.id,
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  }

  const jwtToken = await createJWT(jwtPayload, env.JWT_SECRET)

  return new Response(JSON.stringify({
    access_token: jwtToken,
    refresh_token: tokens.refresh_token || refresh_token,
    expires_in: 24 * 60 * 60,
    token_type: 'Bearer',
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

async function handleTokenVerification(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const authHeader = request.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized', {
      status: 401,
      headers: corsHeaders
    })
  }

  const token = authHeader.substring(7)

  try {
    const payload = await verifyJWT(token, env.JWT_SECRET)

    return new Response(JSON.stringify({
      valid: true,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({
      valid: false,
      error: 'Invalid token',
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  }
}

// JWT utility functions
async function createJWT(payload: any, secret: string): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const data = `${encodedHeader}.${encodedPayload}`
  const signature = await sign(data, secret)

  return `${data}.${signature}`
}

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
