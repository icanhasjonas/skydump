export interface User {
  id: string
  email: string
  name: string
  picture?: string
}

export interface AuthTokens {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

/**
 * Get the current user from localStorage
 */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null

  try {
    const userInfo = localStorage.getItem('user_info')
    return userInfo ? JSON.parse(userInfo) : null
  } catch (error) {
    console.error('Error parsing user info:', error)
    return null
  }
}

/**
 * Get the current access token from localStorage
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null

  return localStorage.getItem('access_token')
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getCurrentUser() !== null && getAccessToken() !== null
}

/**
 * Clear authentication data
 */
export function clearAuth(): void {
  if (typeof window === 'undefined') return

  localStorage.removeItem('access_token')
  localStorage.removeItem('user_info')
  localStorage.removeItem('refresh_token')
}

/**
 * Generate Google OAuth URL
 */
export function getGoogleAuthUrl(): string {
  const clientId = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID
  const redirectUri = import.meta.env.PUBLIC_GOOGLE_REDIRECT_URI

  if (!clientId || !redirectUri) {
    throw new Error('Google OAuth configuration missing')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent'
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Make authenticated API request
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()

  if (!token) {
    throw new Error('No access token available')
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // If unauthorized, clear auth and redirect to login
  if (response.status === 401) {
    clearAuth()
    window.location.href = '/'
    throw new Error('Authentication expired')
  }

  return response
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const refreshToken = localStorage.getItem('refresh_token')

    if (!refreshToken) {
      return false
    }

    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!response.ok) {
      return false
    }

    const data = await response.json()

    localStorage.setItem('access_token', data.access_token)

    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token)
    }

    return true
  } catch (error) {
    console.error('Error refreshing token:', error)
    return false
  }
}

/**
 * Logout user
 */
export function logout(): void {
  clearAuth()
  window.location.href = '/'
}
