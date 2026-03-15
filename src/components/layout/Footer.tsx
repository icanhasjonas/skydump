import { Separator } from "@/components/ui/separator"

export default function Footer() {
  return (
    <footer className="py-6 px-6">
      <Separator className="mb-6 opacity-20" />
      <div className="max-w-7xl mx-auto flex justify-between items-center text-sm text-muted-foreground">
        <span>Lanta Dev Team</span>
        <span>{new Date().getFullYear()}</span>
      </div>
    </footer>
  )
}
