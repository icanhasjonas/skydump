import { Button } from "@/components/ui/button"

interface HeaderProps {
  showBack?: boolean
}

export default function Header({ showBack }: HeaderProps) {
  return (
    <header className="py-4 px-6">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <a
          href="/"
          className="text-2xl font-black text-foreground hover:text-primary transition-colors tracking-tight"
        >
          <span className="text-primary">SKY</span> DUMP
        </a>
        <nav className="flex gap-2">
          {showBack ? (
            <Button variant="ghost" asChild>
              <a href="/">Home</a>
            </Button>
          ) : (
            <Button variant="ghost" asChild>
              <a href="/upload/">Upload</a>
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
