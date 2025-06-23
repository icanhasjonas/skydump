#!/bin/bash

# SKY DUMP Deployment Script
# This script helps deploy all components of the SKY DUMP application

set -e

echo "🚀 SKY DUMP Deployment Script"
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

    if ! command -v npx &> /dev/null; then
        print_error "npx is not installed. Please install npx and try again."
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

# Build the Astro site
build_site() {
    print_status "Building Astro site..."
    npm run build
    print_success "Site built successfully"
}

# Deploy Cloudflare Workers
deploy_workers() {
    print_status "Deploying Cloudflare Workers..."

    # Deploy Auth Worker
    print_status "Deploying Auth Worker..."
    cd workers/auth
    npx wrangler deploy
    cd ../..
    print_success "Auth Worker deployed"

    # Deploy Upload Worker
    print_status "Deploying Upload Worker..."
    cd workers/upload
    npx wrangler deploy
    cd ../..
    print_success "Upload Worker deployed"

    # Deploy Email Worker
    print_status "Deploying Email Worker..."
    cd workers/email
    npx wrangler deploy
    cd ../..
    print_success "Email Worker deployed"

    # Deploy Webhook Worker
    print_status "Webhook worker removed - no longer needed with R2 integration"
    cd ../..
    print_success "Webhook Worker deployed"

    print_success "All workers deployed successfully"
}

# Deploy Astro site to Cloudflare Pages
deploy_site() {
    print_status "Deploying site to Cloudflare Pages..."
    npx wrangler pages deploy dist
    print_success "Site deployed successfully"
}

# Create KV namespaces
create_kv_namespaces() {
    print_status "Creating KV namespaces..."

    print_status "Creating production KV namespace..."
    npx wrangler kv:namespace create "UPLOAD_KV"

    print_status "Creating preview KV namespace..."
    npx wrangler kv:namespace create "UPLOAD_KV" --preview

    print_warning "Please update the KV namespace IDs in your wrangler.toml files"
    print_success "KV namespaces created"
}

# Setup environment check
check_environment() {
    print_status "Checking environment configuration..."

    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Please create one based on the README instructions."
    else
        print_success ".env file found"
    fi

    # Check if required environment variables are set
    required_vars=("GOOGLE_CLIENT_ID" "GOOGLE_CLIENT_SECRET" "JWT_SECRET" "CLOUDFLARE_ACCOUNT_ID" "R2_ACCESS_KEY_ID" "R2_SECRET_ACCESS_KEY" "R2_BUCKET_NAME")

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            print_warning "Environment variable $var is not set"
        fi
    done
}

# Main deployment function
main() {
    echo ""
    print_status "Starting SKY DUMP deployment process..."
    echo ""

    # Parse command line arguments
    SKIP_DEPS=false
    SKIP_BUILD=false
    SKIP_WORKERS=false
    SKIP_SITE=false
    CREATE_KV=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-deps)
                SKIP_DEPS=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-workers)
                SKIP_WORKERS=true
                shift
                ;;
            --skip-site)
                SKIP_SITE=true
                shift
                ;;
            --create-kv)
                CREATE_KV=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-deps     Skip dependency installation"
                echo "  --skip-build    Skip building the site"
                echo "  --skip-workers  Skip deploying workers"
                echo "  --skip-site     Skip deploying the site"
                echo "  --create-kv     Create KV namespaces"
                echo "  --help          Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Run deployment steps
    check_dependencies
    check_environment

    if [ "$SKIP_DEPS" = false ]; then
        install_dependencies
    fi

    if [ "$SKIP_BUILD" = false ]; then
        build_site
    fi

    if [ "$CREATE_KV" = true ]; then
        create_kv_namespaces
    fi

    if [ "$SKIP_WORKERS" = false ]; then
        deploy_workers
    fi

    if [ "$SKIP_SITE" = false ]; then
        deploy_site
    fi

    echo ""
    print_success "🎉 SKY DUMP deployment completed successfully!"
    echo ""
    print_status "Next steps:"
    echo "1. Update environment variables in Cloudflare Pages and Workers"
    echo "2. Test the application"
    echo "4. Set up monitoring and alerts"
    echo ""
    print_status "For more information, see the README.md file"
}

# Run main function with all arguments
main "$@"
