#!/bin/bash
set -e

echo "🚀 Setting up Sketchbook..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env created"
else
    echo "✅ .env already exists"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Start infrastructure services
echo "🐳 Starting infrastructure services (Redis, MinIO, PostgreSQL)..."
docker-compose up -d redis minio postgres

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Wait for services to be healthy
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker-compose ps | grep -q "healthy"; then
        redis_healthy=$(docker-compose ps redis | grep -c "healthy" || echo "0")
        minio_healthy=$(docker-compose ps minio | grep -c "healthy" || echo "0")
        postgres_healthy=$(docker-compose ps postgres | grep -c "healthy" || echo "0")
        
        if [ "$redis_healthy" -eq 1 ] && [ "$minio_healthy" -eq 1 ] && [ "$postgres_healthy" -eq 1 ]; then
            echo "✅ All services are healthy"
            break
        fi
    fi
    
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
        echo "⚠️  Services took longer than expected to start, but continuing..."
        break
    fi
    
    sleep 2
done

echo ""

# Install npm dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
    echo "✅ Dependencies installed"
else
    echo "✅ node_modules already exists"
fi

echo ""

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate
echo "✅ Prisma client generated"

echo ""

# Run database migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy
echo "✅ Database migrations complete"

echo ""
echo "✨ Setup complete!"
echo ""
echo "📚 Available commands:"
echo "  npm run dev              - Start development server (native)"
echo "  make app-dev             - Start development server (Docker)"
echo "  make redis               - Start only Redis"
echo "  make minio               - Start only MinIO"
echo "  make postgres            - Start only PostgreSQL"
echo "  make dc-up               - Start all services with Docker"
echo "  make dc-down             - Stop all services"
echo ""
echo "🌐 Service URLs:"
echo "  App:            http://localhost:3000"
echo "  MinIO Console:  http://localhost:9001 (user: minio, pass: minio123)"
echo "  PostgreSQL:     localhost:5432"
echo "  Redis:          localhost:6379"
echo ""
