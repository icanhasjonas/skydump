export interface Bindings {
  R2: R2Bucket
  KV: KVNamespace
  DB: D1Database
  ASSETS: Fetcher
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
}

export const R2_BUCKET = "sky-dump"
export const R2_ACCOUNT_ID = "e6bd4c9e08862c4b3c8ddacbbef253b1"
export const R2_S3_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
