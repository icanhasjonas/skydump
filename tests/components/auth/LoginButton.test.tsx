import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LoginButton from '../../../src/components/auth/LoginButton'

// Mock the auth utility
vi.mock('../../../src/utils/auth', () => ({
  getGoogleAuthUrl: vi.fn(() => 'https://accounts.google.com/o/oauth2/v2/auth?test=true')
}))

describe('LoginButton', () => {
  it('renders login button correctly', () => {
    render(<LoginButton />)

    const button = screen.getByRole('button', { name: /continue with google/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('bg-white')
  })

  it('calls getGoogleAuthUrl when clicked', async () => {
    const { getGoogleAuthUrl } = await import('../../../src/utils/auth')

    // Mock window.location.href
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true
    })

    render(<LoginButton />)

    const button = screen.getByRole('button', { name: /continue with google/i })
    fireEvent.click(button)

    expect(getGoogleAuthUrl).toHaveBeenCalledOnce()
  })

  it('has correct styling', () => {
    render(<LoginButton />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-white', 'border', 'border-gray-300', 'text-gray-700')
  })
})
