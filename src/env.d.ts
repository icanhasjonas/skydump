/// <reference path="../.astro/types.d.ts" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>

interface Env {
  R2: R2Bucket
  KV: KVNamespace
  DB: D1Database
  ASSETS: Fetcher
}

declare namespace App {
  interface Locals extends Runtime {}
}
