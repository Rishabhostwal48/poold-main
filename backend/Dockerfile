FROM node:18

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --silent

# Copy the rest of the backend source
COPY . .

# Expose the default backend port
EXPOSE 3000

# Start the backend
CMD ["node", "index.js"]
