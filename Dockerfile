# Use Node.js as base image
#FROM mcr.microsoft.com/playwright:v1.50.1-noble
FROM node:23-alpine

# Set working directory
WORKDIR /app

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Copy package files first (to leverage caching)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install && \
    npx playwright install --with-deps chromium

# Copy the rest of the project files
COPY . .

# Build the project
RUN npm run build

# Expose ports for API
EXPOSE 3000

## Start nextjs project
CMD ["npm", "run", "start"]