import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const features = [
  { title: "5GB Uploads", desc: "Massive file support with chunked multipart uploads" },
  { title: "No Account", desc: "Just drop your files and go. Zero friction." },
  { title: "Blazing Fast", desc: "Powered by Cloudflare's global edge network" },
]

export default function Hero() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-6xl md:text-8xl font-black mb-6 tracking-tight">
          <span className="text-primary">SKY</span> <span className="text-foreground">DUMP</span>
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Upload video files up to 5GB. Fast, simple, no account needed.
        </p>
        <Button asChild size="lg" className="text-lg px-8 py-6 h-auto font-bold">
          <a href="/upload/">Start Uploading</a>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full">
        {features.map((f) => (
          <Card key={f.title} className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent>
              <h3 className="text-lg font-bold text-foreground mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
