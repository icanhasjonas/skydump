// Test setup configuration for SKY DUMP
import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock environment variables for testing
vi.mock('astro:env/client', () => ({
  PUBLIC_GOOGLE_CLIENT_ID: 'test-client-id',
  PUBLIC_GOOGLE_REDIRECT_URI: 'http://localhost:4321/auth/callback',
  PUBLIC_AUTH_WORKER_URL: 'http://localhost:8787',
  PUBLIC_UPLOAD_WORKER_URL: 'http://localhost:8788'
}))

// Mock fetch for API calls
global.fetch = vi.fn()

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  },
  writable: true
})

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  },
  writable: true
})

// Mock crypto for JWT operations
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-123',
    subtle: {
      sign: vi.fn(),
      verify: vi.fn(),
      importKey: vi.fn()
    }
  }
})
