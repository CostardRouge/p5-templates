# Use Node.js as base image
FROM mcr.microsoft.com/playwright:v1.50.1-noble

# Set working directory
WORKDIR /app

# Install system dependencies including ffmpeg
RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    libvpx9 \
    libopus0 \
    libwebpdemux2 \
    libx264-163 \
    libopenh264-7 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first (to leverage caching)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the project files
COPY . .

# Build the project
RUN npm run build

# Expose ports for API
EXPOSE 3000

## Start nextjs project
CMD ["npm", "run", "start"]