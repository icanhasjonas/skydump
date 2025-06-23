/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GOOGLE_CLIENT_ID: string
  readonly GOOGLE_CLIENT_SECRET: string
  readonly GOOGLE_REDIRECT_URI: string
  readonly JWT_SECRET: string
  readonly CLOUDFLARE_ACCOUNT_ID: string
  readonly R2_ACCESS_KEY_ID: string
  readonly R2_SECRET_ACCESS_KEY: string
  readonly R2_BUCKET_NAME: string
  readonly NOTIFICATION_EMAIL: string
  readonly CLOUDFLARE_EMAIL_API_TOKEN: string
  readonly UPLOAD_SIZE_LIMIT: string
  readonly MAX_UPLOADS_PER_USER_PER_DAY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
