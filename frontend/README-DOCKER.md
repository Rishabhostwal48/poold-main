# 🐳 Docker Setup for Vocal Recruiter

Run the Vocal Recruiter frontend locally with Docker while connecting to Supabase Cloud backend.

## 📋 Prerequisites

- **Docker Desktop** (v20.10 or higher)
  - Windows: [Download Docker Desktop](https://www.docker.com/products/docker-desktop)
  - Mac: [Download Docker Desktop](https://www.docker.com/products/docker-desktop)
  - Linux: Install Docker Engine + Docker Compose
- **Git**

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd vocal-recruiter

# Environment variables are already configured in docker-compose.yml
# No need to copy .env files
```

### 2. Start the Application

```bash
# Start in detached mode
docker-compose up -d

# Or start with logs visible
docker-compose up
```

### 3. Access the Application

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:8080 | Main application |

The frontend connects to your existing **Supabase Cloud** backend:
- **Project:** sxfjoqvwtjsiskqwftln
- **Database, Auth, Storage, Edge Functions** - all running in Supabase Cloud

## 📦 Available Commands

```bash
# Start the frontend container
docker-compose up -d

# Stop the container
docker-compose down

# View logs
docker-compose logs -f frontend

# Rebuild after code changes
docker-compose up -d --build frontend

# Restart the container
docker-compose restart frontend

# Stop and remove volumes (fresh start)
docker-compose down -v
docker-compose up -d
```

## 🛠️ Development Workflow

### Hot Reload
The frontend container is mounted with volumes, so code changes are reflected immediately:
- Edit any file in `src/`
- Changes automatically reload in browser
- No need to rebuild container

### Backend Changes
Since your backend is on **Supabase Cloud**:
- **Edge Functions**: Deploy automatically via Lovable or Supabase CLI
- **Database Changes**: Run migrations through Lovable or Supabase Dashboard
- **Authentication**: Manage in Supabase Dashboard
- No need to restart Docker containers for backend changes

## 🏗️ Architecture

```
┌─────────────────────────┐
│   Docker Container      │
│                         │
│   ┌─────────────────┐   │
│   │  React Frontend │   │
│   │  (Port 8080)    │   │
│   │  + Hot Reload   │   │
│   └────────┬────────┘   │
└────────────┼────────────┘
             │
             │ HTTPS
             │
             ▼
┌─────────────────────────┐
│   Supabase Cloud        │
│  (sxfjoqvwtjsiskqwftln) │
│                         │
│  • PostgreSQL Database  │
│  • Authentication       │
│  • Storage Buckets      │
│  • Edge Functions       │
│  • Realtime             │
└─────────────────────────┘
```

## 📝 Configuration

### Environment Variables
All environment variables are configured in `docker-compose.yml`:

```yaml
VITE_SUPABASE_URL=https://sxfjoqvwtjsiskqwftln.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_SUPABASE_EDGE_URL=https://sxfjoqvwtjsiskqwftln.supabase.co/functions/v1
VITE_SUPABASE_PROJECT_ID=sxfjoqvwtjsiskqwftln
```

These connect your Docker frontend to the cloud backend.

### Ports
- **8080**: Frontend application (mapped to container's internal port)

### Volumes
The following directories are mounted for hot reload:
- `./src` - Source code
- `./public` - Static assets
- `./index.html` - Entry HTML
- `./package.json` - Dependencies
- `./vite.config.ts` - Vite configuration
- `./tailwind.config.ts` - Tailwind configuration
- `./tsconfig*.json` - TypeScript configuration

## 🐛 Troubleshooting

### Port Already in Use
If port 8080 is already in use:

```bash
# Check what's using the port
# Mac/Linux
lsof -i :8080

# Windows
netstat -ano | findstr :8080

# Kill the process or change ports in docker-compose.yml
```

### Container Not Starting

```bash
# Check logs
docker-compose logs -f frontend

# Rebuild from scratch
docker-compose down -v
docker-compose up -d --build
```

### Frontend Not Loading

```bash
# Restart the container
docker-compose restart frontend

# Check if dependencies are installed
docker-compose exec frontend npm install

# Rebuild with fresh dependencies
docker-compose down
docker-compose up -d --build
```

### Connection to Supabase Cloud Failed

```bash
# Verify environment variables in docker-compose.yml
docker-compose config

# Check if Supabase Cloud is accessible
curl https://sxfjoqvwtjsiskqwftln.supabase.co

# Verify anon key is correct in docker-compose.yml
```

### Permission Issues (Linux)

```bash
# Fix file permissions
sudo chown -R $USER:$USER .

# Restart Docker
sudo systemctl restart docker
docker-compose up -d
```

### Clean Slate

```bash
# Remove everything and start fresh
docker-compose down -v
docker system prune -a
docker-compose up -d --build
```

## 🔄 Updates and Maintenance

### Update Dependencies

```bash
# Update npm packages
npm install
docker-compose up -d --build

# Pull latest Docker base images
docker-compose pull
docker-compose up -d --build
```

### View Container Status

```bash
# Check if container is running
docker-compose ps

# Check resource usage
docker stats
```

### Access Container Shell

```bash
# Open bash in the container
docker-compose exec frontend sh

# Run npm commands inside container
docker-compose exec frontend npm run build
docker-compose exec frontend npm run lint
```

## 🌐 Production Deployment

### Using Production Dockerfile

The production `Dockerfile` creates an optimized build:

```bash
# Build production image
docker build -t vocal-recruiter:prod .

# Run production container
docker run -p 80:80 vocal-recruiter:prod
```

Production features:
- Multi-stage build
- Nginx web server
- Gzip compression
- Security headers
- Optimized caching
- Minified assets

### Production Environment Variables

For production deployment, update the Supabase URLs if you use a different Supabase project:

1. Create `.env.production` file
2. Update `Dockerfile` to use production env vars
3. Or inject at runtime using Docker secrets

## 📊 Monitoring

### View Logs

```bash
# Follow all logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100 frontend

# Since specific time
docker-compose logs --since 2024-01-01T10:00:00
```

### Container Health

```bash
# Check status
docker-compose ps

# Inspect container
docker inspect vocal-recruiter-frontend

# View resource usage
docker stats vocal-recruiter-frontend
```

## 🔒 Security Notes

### Development
- Uses development server (Vite)
- Hot reload enabled
- Source maps available
- Not suitable for production

### Production
When deploying to production:

1. **Use production Dockerfile** (multi-stage build with Nginx)
2. **Enable HTTPS** with reverse proxy (nginx, Traefik, Caddy)
3. **Update security headers** in `nginx.conf`
4. **Set proper CORS** in Supabase Dashboard
5. **Use environment-specific Supabase projects**
6. **Enable rate limiting** on your infrastructure
7. **Monitor logs** for security issues

### API Keys
- All Supabase keys are in `docker-compose.yml`
- **Anon key is public** (safe to expose in frontend)
- **Service role key** should never be in frontend (not in this setup)
- Manage secrets in Supabase Dashboard

## 🆘 Common Issues

### "Cannot find module" errors
```bash
# Reinstall dependencies
docker-compose down
docker-compose up -d --build
```

### Styles not loading
```bash
# Clear Vite cache
docker-compose exec frontend rm -rf node_modules/.vite
docker-compose restart frontend
```

### Changes not reflecting
```bash
# Ensure volumes are mounted correctly
docker-compose config | grep volumes

# Force rebuild
docker-compose up -d --build --force-recreate
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Supabase Documentation](https://supabase.com/docs)
- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)

## 🆘 Support

If you encounter issues:

1. **Check logs**: `docker-compose logs -f frontend`
2. **Verify Docker is running**: `docker ps`
3. **Check Supabase status**: Visit [Supabase Status](https://status.supabase.com/)
4. **Review troubleshooting section** above
5. **Try clean slate**: `docker-compose down -v && docker-compose up -d --build`

## 📝 License

Same as main project.
