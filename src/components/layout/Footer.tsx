export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <h2 className="text-lg font-bold text-gray-900">
              <span className="text-blue-600">SKY</span> DUMP
            </h2>
            <span className="ml-4 text-sm text-gray-500">
              Secure video upload service
            </span>
          </div>

          <div className="flex items-center space-x-6 text-sm text-gray-500">
            <span>Powered by Astro + Cloudflare + B2</span>
            <span>©️ {new Date().getFullYear()}</span>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Features</h3>
              <ul className="space-y-1">
                <li>• Large file uploads (up to 5GB)</li>
                <li>• Multiple file support</li>
                <li>• Real-time progress tracking</li>
                <li>• Secure Google authentication</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Supported Formats</h3>
              <ul className="space-y-1">
                <li>• MP4, MOV, AVI</li>
                <li>• MKV, WebM</li>
                <li>• All major video formats</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Security</h3>
              <ul className="space-y-1">
                <li>• Google OAuth authentication</li>
                <li>• Secure file storage</li>
                <li>• Rate limiting protection</li>
                <li>• HTTPS encryption</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
