# SKY DUMP 🌌

A modern video upload service built with Astro 5.8, featuring Google OAuth authentication, drag & drop uploads, and cloud storage integration.

## ✨ Features

- **🔐 Google OAuth Authentication** - Secure user authentication with Google
- **📁 Drag & Drop Upload** - Intuitive file upload with Uppy
- **☁️ Cloud Storage** - Cloudflare R2 integration for reliable storage
- **📧 Email Notifications** - Automated upload confirmation emails
- **🔄 Real-time Progress** - Live upload progress tracking
- **📱 Responsive Design** - Works on all devices
- **⚡ Serverless Backend** - Cloudflare Workers for scalable API
- **🎨 Modern UI** - Clean design with TailwindCSS

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account (for Workers and Pages)
- Google Cloud Console account (for OAuth)
- Cloudflare account with R2 enabled (for storage)
- Email service account (Mailgun/SendGrid)

### 1. Clone and Install

```bash
git clone <repository-url>
cd sky-dump
npm install
```

### 2. Run Setup Script

```bash
chmod +x scripts/dev-setup.sh
./scripts/dev-setup.sh
```

This will:
- Install all dependencies
- Create `.env` template
- Set up development scripts
- Configure the project structure

### 3. Configure Environment Variables

Update the `.env` file with your actual values:

```env
# Google OAuth Configuration
PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:4321/auth/callback

# JWT Secret (generate a strong random string)
JWT_SECRET=your_jwt_secret_key_here

# Cloudflare R2 Configuration
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id_here
R2_ACCESS_KEY_ID=your_r2_access_key_id_here
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
R2_BUCKET_NAME=your_r2_bucket_name_here

# Email Service Configuration
EMAIL_API_KEY=your_email_api_key_here
FROM_EMAIL=noreply@yourdomain.com

# Email Service Configuration
EMAIL_API_KEY=your_email_api_key_here
FROM_EMAIL=noreply@yourdomain.com
```

### 4. Start Development

```bash
# Start Astro development server
npm run dev

# Start all Cloudflare Workers (in another terminal)
npm run dev:workers

# Or start both together
npm run dev:full
```

## 🔧 Configuration Guide

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:4321/auth/callback` (development)
   - `https://yourdomain.com/auth/callback` (production)

### Cloudflare R2 Setup

1. Enable R2 in your Cloudflare dashboard
2. Create a bucket for video storage
3. Generate application key with read/write permissions
4. Configure CORS settings for your domain
5. Set up lifecycle rules if needed

### Email Service Setup

Choose one of these providers:

**Mailgun:**
```env
EMAIL_API_KEY=your_mailgun_api_key
EMAIL_DOMAIN=your_mailgun_domain
```

**SendGrid:**
```env
EMAIL_API_KEY=your_sendgrid_api_key
FROM_EMAIL=verified_sender@yourdomain.com
```

### Cloudflare Workers Setup

1. Install Wrangler CLI: `npm install -g wrangler`
2. Login: `wrangler auth login`
3. Create KV namespaces:
   ```bash
   wrangler kv:namespace create "AUTH_SESSIONS"
   wrangler kv:namespace create "UPLOAD_METADATA"
   wrangler kv:namespace create "EMAIL_QUEUE"
   ```
4. Update `wrangler.toml` files with your KV namespace IDs

## 📁 Project Structure

```
sky-dump/
├── src/
│   ├── components/
│   │   ├── auth/           # Authentication components
│   │   ├── layout/         # Layout components
│   │   └── upload/         # Upload components
│   ├── pages/              # Astro pages
│   ├── utils/              # Utility functions
│   └── styles/             # CSS styles
├── workers/
│   ├── auth/               # Authentication worker
│   ├── upload/             # Upload handling worker
│   └── email/              # Email notification worker
├── tests/                  # Test files
└── scripts/                # Deployment scripts
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests once
npm run test:run

# Run with coverage
npm run test:coverage
```

## 🚀 Deployment

### Automated Deployment

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### Manual Deployment

1. **Deploy Workers:**
   ```bash
   cd workers/auth && wrangler deploy
   cd ../upload && wrangler deploy
   cd ../email && wrangler deploy
   ```

2. **Deploy Site:**
   ```bash
   npm run build
   wrangler pages deploy dist
   ```

### Environment Variables for Production

Update your production environment variables:

```env
PUBLIC_GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/callback
PUBLIC_AUTH_WORKER_URL=https://auth-worker.yourname.workers.dev
PUBLIC_UPLOAD_WORKER_URL=https://upload-worker.yourname.workers.dev
EMAIL_WORKER_URL=https://email-worker.yourname.workers.dev
```

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **CORS Protection** - Proper cross-origin request handling
- **Input Validation** - Server-side validation for all inputs
- **File Type Validation** - Only allow specific video formats
- **Rate Limiting** - Prevent abuse with request limits
- **Secure Upload URLs** - Time-limited presigned URLs for direct uploads

## 📊 Monitoring

### Cloudflare Analytics

- Worker execution metrics
- Error rates and response times
- Geographic distribution of requests

### Custom Logging

Workers include structured logging for:
- Authentication events
- Upload progress
- Error tracking
- Performance metrics

## 🛠️ Development Commands

```bash
# Development
npm run dev                 # Start Astro dev server
npm run dev:workers         # Start all workers
npm run dev:full           # Start both Astro and workers
npm run dev:stop           # Stop all workers

# Testing
npm test                   # Run tests in watch mode
npm run test:ui            # Run tests with UI
npm run test:run           # Run tests once
npm run test:coverage      # Run with coverage

# Building
npm run build              # Build for production
npm run preview            # Preview production build

# Linting & Formatting
npm run lint               # Lint code
npm run lint:fix           # Fix linting issues
npm run format             # Format code

# Deployment
npm run deploy             # Deploy to production
```

## 🐛 Troubleshooting

### Common Issues

**OAuth Redirect Mismatch:**
- Ensure redirect URI in Google Console matches your environment
- Check for trailing slashes in URLs

**Upload Failures:**
- Verify R2 credentials and bucket permissions
- Check CORS configuration
- Ensure file size limits are appropriate

**Worker Deployment Issues:**
- Verify KV namespace IDs in wrangler.toml
- Check environment variables are set
- Ensure proper authentication with Cloudflare

**Email Not Sending:**
- Verify email service credentials
- Check sender email is verified
- Review email service logs

### Debug Mode

Enable debug logging by setting:
```env
DEBUG=true
LOG_LEVEL=debug
```

## 📚 API Documentation

### Authentication Endpoints

- `POST /auth/google` - Exchange OAuth code for tokens
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user

### Upload Endpoints

- `POST /upload/signed-url` - Get signed upload URL
- `POST /upload/complete` - Mark upload as complete
- `GET /upload/status/:id` - Check upload status

### Webhook Endpoints



## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Check the troubleshooting section
- Review the architecture documentation
- Open an issue on GitHub

---

Built with ❤️ using Astro, React, and Cloudflare Workers.
