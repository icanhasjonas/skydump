import LoginButton from '../auth/LoginButton'
import Footer from '../layout/Footer'

export default function Hero() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 text-white flex flex-col">
      {/* Main Hero Content */}
      <div className="flex-1 flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="text-yellow-300">SKY</span> DUMP
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100">
              Secure, fast, and reliable video upload service
            </p>
            <p className="text-lg mb-12 text-blue-200 max-w-2xl mx-auto">
              Upload large video files up to 5GB with real-time progress tracking.
              Choose your upload method below.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-8">
              <div className="relative group">
                <a
                  href="/dashboard"
                  className="px-8 py-4 bg-yellow-400 text-gray-900 font-bold rounded-lg hover:bg-yellow-300 transition-colors text-lg"
                >
                  Upload Anonymously
                </a>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                  We won't be able to give credit if you upload anonymously
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                </div>
              </div>

              <LoginButton />
            </div>

            {/* Information Box */}
            <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <svg className="w-5 h-5 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-white mb-2">Upload Options</h3>
                  <div className="text-sm text-blue-100 space-y-2">
                    <p><strong>Anonymous Upload:</strong> Quick and private, but we won't be able to provide attribution for your videos.</p>
                    <p><strong>Google Sign-in:</strong> Allows us to attach attribution to your uploaded videos and provide additional features.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer at bottom */}
      <Footer />
    </div>
  )
}
