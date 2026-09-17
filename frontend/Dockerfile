FROM node:18-bullseye AS dev

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --silent

# Copy source
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Default: run Vite dev server and listen on all interfaces
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
# Multi-stage build for React frontend
FROM node:20-bullseye AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# test commits 
