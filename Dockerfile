# Use Playwright base image with Chromium pre-installed
FROM mcr.microsoft.com/playwright:v1.50.1-jammy

# Set working directory
WORKDIR /app

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

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

# Start Next.js project
CMD ["npm", "run", "start"]
