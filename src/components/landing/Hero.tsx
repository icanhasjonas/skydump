import LoginButton from '../auth/LoginButton'

export default function Hero() {
  return (
    <div className="bg-gradient-to-br from-blue-600 to-purple-700 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="text-yellow-300">SKY</span> DUMP
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-blue-100">
            Secure, fast, and reliable video upload service
          </p>
          <p className="text-lg mb-12 text-blue-200 max-w-2xl mx-auto">
            Upload large video files up to 5GB with real-time progress tracking.
            No account required - upload anonymously or sign in for extra features.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="/dashboard"
              className="px-8 py-4 bg-yellow-400 text-gray-900 font-bold rounded-lg hover:bg-yellow-300 transition-colors text-lg"
            >
              Start Uploading
            </a>
            <LoginButton />
            <a
              href="#features"
              className="px-6 py-3 border-2 border-white text-white rounded-lg hover:bg-white hover:text-blue-600 transition-colors"
            >
              Learn More
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
