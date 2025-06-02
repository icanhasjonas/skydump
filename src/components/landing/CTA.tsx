import LoginButton from '../auth/LoginButton'

export default function CTA() {
  return (
    <div className="bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Ready to Upload Your Videos?
        </h2>
        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
          Start uploading immediately - no account required! Sign in for extra features like upload history.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a
            href="/dashboard"
            className="px-8 py-4 bg-yellow-400 text-gray-900 font-bold rounded-lg hover:bg-yellow-300 transition-colors text-lg"
          >
            Upload Now
          </a>
          <LoginButton />
        </div>
      </div>
    </div>
  )
}
