#!/bin/bash

# SKY DUMP Development Setup Script
# This script helps set up the development environment

set -e

echo "🛠️  SKY DUMP Development Setup"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."

    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi

    print_success "All dependencies are installed"
}

# Install project dependencies
install_dependencies() {
    print_status "Installing project dependencies..."
    npm install
    print_success "Dependencies installed"
}

# Create .env file template
create_env_template() {
    if [ ! -f ".env" ]; then
        print_status "Creating .env template..."
        cat > .env << 'EOF'
# Google OAuth Configuration
PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:4321/auth/callback

# JWT Secret (generate a strong random string)
JWT_SECRET=your_jwt_secret_key_here

# B2 Backblaze Configuration
B2_APPLICATION_KEY_ID=your_b2_key_id_here
B2_APPLICATION_KEY=your_b2_application_key_here
B2_BUCKET_ID=your_b2_bucket_id_here
B2_BUCKET_NAME=your_b2_bucket_name_here

# Email Service Configuration
EMAIL_API_KEY=your_email_api_key_here
FROM_EMAIL=noreply@localhost

# Webhook Secret (generate a strong random string)
WEBHOOK_SECRET=your_webhook_secret_here

# Development Worker URLs
PUBLIC_AUTH_WORKER_URL=http://localhost:8787
PUBLIC_UPLOAD_WORKER_URL=http://localhost:8788
EMAIL_WORKER_URL=http://localhost:8789
WEBHOOK_WORKER_URL=http://localhost:8790
EOF
        print_success ".env template created"
        print_warning "Please update the .env file with your actual configuration values"
    else
        print_status ".env file already exists, skipping template creation"
    fi
}

# Create development scripts
create_dev_scripts() {
    print_status "Creating development scripts..."

    # Create start-workers script
    cat > scripts/start-workers.sh << 'EOF'
#!/bin/bash

# Start all Cloudflare Workers for development

echo "🚀 Starting SKY DUMP Workers"
echo "============================"

# Function to start worker in background
start_worker() {
    local name=$1
    local port=$2
    local dir=$3

    echo "Starting $name on port $port..."
    cd $dir
    npx wrangler dev --port $port &
    cd ..
}

# Start all workers
cd workers
start_worker "Auth Worker" 8787 "auth"
start_worker "Upload Worker" 8788 "upload"
start_worker "Email Worker" 8789 "email"
start_worker "Webhook Worker" 8790 "webhook"

echo ""
echo "✅ All workers started!"
echo ""
echo "Worker URLs:"
echo "- Auth Worker:    http://localhost:8787"
echo "- Upload Worker:  http://localhost:8788"
echo "- Email Worker:   http://localhost:8789"
echo "- Webhook Worker: http://localhost:8790"
echo ""
echo "Press Ctrl+C to stop all workers"

# Wait for all background processes
wait
EOF

    chmod +x scripts/start-workers.sh

    # Create stop-workers script
    cat > scripts/stop-workers.sh << 'EOF'
#!/bin/bash

# Stop all Cloudflare Workers

echo "🛑 Stopping SKY DUMP Workers"
echo "============================"

# Kill all wrangler processes
pkill -f "wrangler dev" || true

echo "✅ All workers stopped!"
EOF

    chmod +x scripts/stop-workers.sh

    print_success "Development scripts created"
}

# Update package.json with development scripts
update_package_scripts() {
    print_status "Updating package.json scripts..."

    # Check if jq is available for JSON manipulation
    if command -v jq &> /dev/null; then
        # Use jq to update package.json
        jq '.scripts += {
            "dev:workers": "./scripts/start-workers.sh",
            "dev:stop": "./scripts/stop-workers.sh",
            "dev:full": "concurrently \"npm run dev\" \"npm run dev:workers\"",
            "setup": "./scripts/dev-setup.sh",
            "deploy": "./scripts/deploy.sh"
        }' package.json > package.json.tmp && mv package.json.tmp package.json

        print_success "Package.json scripts updated"
    else
        print_warning "jq not found. Please manually add these scripts to package.json:"
        echo '  "dev:workers": "./scripts/start-workers.sh",'
        echo '  "dev:stop": "./scripts/stop-workers.sh",'
        echo '  "dev:full": "concurrently \"npm run dev\" \"npm run dev:workers\"",'
        echo '  "setup": "./scripts/dev-setup.sh",'
        echo '  "deploy": "./scripts/deploy.sh"'
    fi
}

# Install additional development dependencies
install_dev_dependencies() {
    print_status "Installing development dependencies..."

    # Check if concurrently is already installed
    if ! npm list concurrently &> /dev/null; then
        npm install --save-dev concurrently
        print_success "Concurrently installed for running multiple processes"
    else
        print_status "Concurrently already installed"
    fi
}

# Display setup completion message
show_completion_message() {
    echo ""
    print_success "🎉 Development environment setup completed!"
    echo ""
    print_status "Next steps:"
    echo "1. Update the .env file with your configuration values"
    echo "2. Set up Google OAuth credentials"
    echo "3. Configure B2 Backblaze storage"
    echo "4. Set up email service credentials"
    echo ""
    print_status "Development commands:"
    echo "• npm run dev              - Start Astro development server"
    echo "• npm run dev:workers      - Start all Cloudflare Workers"
    echo "• npm run dev:full         - Start both Astro and Workers"
    echo "• npm run dev:stop         - Stop all workers"
    echo ""
    print_status "For detailed setup instructions, see README.md"
}

# Main setup function
main() {
    echo ""
    print_status "Setting up SKY DUMP development environment..."
    echo ""

    check_dependencies
    install_dependencies
    install_dev_dependencies
    create_env_template
    create_dev_scripts
    update_package_scripts
    show_completion_message
}

# Run main function
main "$@"
