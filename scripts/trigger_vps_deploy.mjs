import { runRemote } from './vps_exec.mjs';

console.log('=== Starting Resilient Production Deployment to https://app.vetrx.brightbase.in ===');

const deployCmd = `
  set -e
  cd /home/ncms/VetRx
  echo ">>> [1/6] Pulling latest code changes from origin main..."
  git pull origin main

  echo ">>> [2/6] Ensuring base images are present in Docker cache..."
  for i in 1 2 3; do docker pull node:22-alpine && break || sleep 2; done
  for i in 1 2 3; do docker pull nginx:1.27-alpine && break || sleep 2; done

  echo ">>> [3/6] Building production docker images (backend, frontend, website)..."
  docker compose -f docker-compose.prod.yml build backend
  docker compose -f docker-compose.prod.yml build frontend
  docker compose -f docker-compose.prod.yml build --no-cache website

  echo ">>> [4/6] Applying Prisma database migrations..."
  docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy --schema=./prisma/schema.prisma

  echo ">>> [5/6] Updating running containers with zero downtime..."
  docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate website
  docker compose -f docker-compose.prod.yml up -d --no-deps backend frontend

  echo ">>> [6/6] Verifying container health and endpoints..."
  sleep 5
  docker compose -f docker-compose.prod.yml ps
  
  echo "Testing internal API health..."
  curl -s -f http://127.0.0.1:4000/api/health || (echo "Backend health check failed!" && exit 1)
  echo ""

  echo "Testing internal Frontend health..."
  curl -s -f http://127.0.0.1:3000/healthz || (echo "Frontend health check failed!" && exit 1)
  echo ""

  echo "Testing external HTTPS app domain..."
  curl -s -f -I https://app.vetrx.brightbase.in/login | head -n 5
  echo ""

  echo "DEPLOYMENT_SUCCESSFUL"
`;

try {
  const result = runRemote(deployCmd);
  console.log(result);
} catch (err) {
  console.error('Deployment error:', err.message);
  if (err.stdout) console.log('STDOUT:', err.stdout);
  if (err.stderr) console.error('STDERR:', err.stderr);
  process.exit(1);
}
