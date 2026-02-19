export default function Footer() {
  return (
    <footer className="py-6 px-6">
      <div className="max-w-7xl mx-auto flex justify-between items-center text-sm text-blue-200/60">
        <span>Lanta Dev Team</span>
        <span>{new Date().getFullYear()}</span>
      </div>
    </footer>
  )
}
