import { useContext } from 'react'
import { AuthContext, type AuthContextType } from '../auth/AuthProvider'
import UserProfile from '../auth/UserProfile'
import LoginButton from '../auth/LoginButton'

export default function Header() {
  // Use useContext directly to handle cases where AuthProvider might not be available
  const authContext = useContext(AuthContext) as AuthContextType | undefined
  const isAuthenticated = authContext?.isAuthenticated || false

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <a href="/" className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
              <span className="text-blue-600">SKY</span> DUMP
            </a>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-8">
            <a href="/" className="text-gray-700 hover:text-gray-900 transition-colors">
              Home
            </a>
            <a href="/dashboard" className="text-gray-700 hover:text-gray-900 transition-colors">
              Dashboard
            </a>
          </nav>

          {/* Auth Section */}
          <div className="flex items-center">
            {isAuthenticated ? <UserProfile /> : <LoginButton />}
          </div>
        </div>
      </div>
    </header>
  )
}
