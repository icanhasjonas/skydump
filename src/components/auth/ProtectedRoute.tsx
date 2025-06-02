import { useContext } from 'react'
import { AuthContext } from './AuthProvider'
import LoginButton from './LoginButton'
import type { ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
  fallback?: ReactNode
}

export default function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const context = useContext(AuthContext)

  // If no AuthProvider, show fallback or nothing
  if (!context) {
    return fallback || null
  }

  const { isAuthenticated, isLoading } = context

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return fallback || (
      <div className="flex flex-col items-center justify-center min-h-64 gap-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please sign in to upload videos to SKY DUMP</p>
          <LoginButton />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
