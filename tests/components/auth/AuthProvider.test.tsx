import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../../src/components/auth/AuthProvider'
import * as authUtils from '../../../src/utils/auth'

// Mock the auth utility
vi.mock('../../../src/utils/auth', () => ({
  getCurrentUser: vi.fn(),
  isAuthenticated: vi.fn(),
  clearAuth: vi.fn(),
  logout: vi.fn(),
  authenticatedFetch: vi.fn()
}))

// Mock fetch globally
global.fetch = vi.fn()

// Test component to access auth context
function TestComponent() {
  const { user, isAuthenticated, logout } = useAuth()

  return (
    <div>
      <div data-testid="user">{user ? user.name : 'No user'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'Yes' : 'No'}</div>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('provides authentication context when not logged in', async () => {
    const mockedAuthUtils = vi.mocked(authUtils)
    const mockFetch = vi.mocked(global.fetch)

    mockedAuthUtils.getCurrentUser.mockReturnValue(null)
    mockedAuthUtils.isAuthenticated.mockReturnValue(false)
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401
    } as Response)

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )
    })

    expect(screen.getByTestId('user')).toHaveTextContent('No user')
    expect(screen.getByTestId('authenticated')).toHaveTextContent('No')
  })

  it('shows authenticated user when logged in', async () => {
    const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' }
    const mockedAuthUtils = vi.mocked(authUtils)
    const mockFetch = vi.mocked(global.fetch)

    mockedAuthUtils.getCurrentUser.mockReturnValue(mockUser)
    mockedAuthUtils.isAuthenticated.mockReturnValue(true)
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: mockUser })
    } as Response)

    await act(async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )
    })

    expect(screen.getByTestId('user')).toHaveTextContent('Test User')
    expect(screen.getByTestId('authenticated')).toHaveTextContent('Yes')
  })
})
