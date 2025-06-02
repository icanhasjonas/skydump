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
            <span>Lanta Dev Team</span>
            <span>©️ {new Date().getFullYear()}</span>
          </div>
        </div>

      </div>
    </footer>
  )
}
