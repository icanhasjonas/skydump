import { useContext } from 'react'
import { AuthContext } from './AuthProvider'

export default function UserProfile() {
  const context = useContext(AuthContext)

  // If no AuthProvider, don't render anything
  if (!context) {
    return null
  }

  const { user, logout, isLoading } = context

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
        <div className="w-20 h-4 bg-gray-200 rounded animate-pulse"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex items-center gap-3">
      {user.picture && (
        <img
          src={user.picture}
          alt={user.name}
          className="w-8 h-8 rounded-full border border-gray-200"
        />
      )}
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900">{user.name}</span>
        <span className="text-xs text-gray-500">{user.email}</span>
      </div>
      <button
        onClick={logout}
        className="ml-4 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}
