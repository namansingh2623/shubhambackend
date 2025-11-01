FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port 3307
EXPOSE 3307

# Start the application
CMD ["npm", "start"]