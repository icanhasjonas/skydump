export default function Header() {
  return (
    <header className="py-4 px-6">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <a
          href="/"
          className="text-2xl font-bold text-white hover:text-yellow-300 transition-colors"
        >
          <span className="text-yellow-300">SKY</span> DUMP
        </a>
      </div>
    </header>
  )
}
