#!/bin/bash
set -e

echo "🚀 Setting up Social Templates Renderer..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env created"
else
    echo "✅ .env already exists"
fi

# Regenerate Prisma client with correct binary targets
echo "🔧 Generating Prisma client for both Mac M1 and Linux ARM64..."
npx prisma generate

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Review and update .env if needed"
echo "  2. Run: make init"
echo "  3. Access the app at http://localhost:3000"
echo "  4. MinIO console at http://localhost:9001 (user: minio, pass: minio123)"
