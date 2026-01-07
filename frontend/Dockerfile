# Stage 1: Build the React Application
FROM node:22-alpine as builder
WORKDIR /app
COPY package.json package-lock.json ./
# Clean install based on lock file
RUN npm install --legacy-peer-deps
COPY . .
# Build for production
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*
# Copy built static files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html
# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
