# Sample TypeScript Server for eBPF Profiling

A TypeScript server designed for profiling with eBPF tools, featuring continuous computation workloads and source map support for symbol resolution.

## Features

- **Continuous CPU-intensive workloads**: Fibonacci calculations, prime number searches, and matrix multiplication
- **Source map generation**: Enables TypeScript symbol resolution in profiling tools
- **Health endpoint**: `/health` for Kubernetes probes
- **Graceful shutdown**: Handles SIGINT/SIGTERM signals
- **Docker containerized**: Multi-stage build with minimal runtime image
- **Kubernetes ready**: Deployment manifests included

## Environment Variables

Both build variants use the same environment variables:

```bash
export POLARSIGNALS_PROJECT_ID=<your-project-id>
export POLARSIGNALS_TOKEN=<your-token>
export POLARSIGNALS_SERVER_URL=grpc.polarsignals.com:443  # optional, this is the default
```

## Build Variants

### esbuild (plugin-based)

Uses `@polarsignals/sourcemap-esbuild-plugin` — debug ID injection and upload happen automatically as part of the esbuild build.

```bash
pnpm run build:esbuild
```

### tsc (CLI-based)

Uses plain `tsc` for compilation, then `@polarsignals/sourcemap-cli` to inject debug IDs and upload source maps.

```bash
pnpm run build:tsc
```

## Running

```bash
# Run esbuild output
pnpm start

# Run tsc output
pnpm start:tsc
```

## Docker Build & Run

```bash
# Build the Docker image
docker build -t sample-ts-server:latest .

# Run locally
docker run -p 3000:3000 sample-ts-server:latest

# Test health endpoint
curl http://localhost:3000/health
```

## Kubernetes Deployment

### Prerequisites
- Colima cluster running
- Docker image available in cluster

```bash
# Build and load image into Colima
docker build -t sample-ts-server:latest .
docker save sample-ts-server:latest | colima ssh -- sudo ctr -n k8s.io image import -

# Deploy to Kubernetes
kubectl apply -f k8s-deployment.yaml

# Check deployment status
kubectl get pods -n sample-ts

# Check assigned NodePort and access service
kubectl get svc -n sample-ts
curl http://localhost:<nodeport>/health  # Use the assigned port from above command

# View logs
kubectl logs -n sample-ts -l app=sample-ts-server -f
```

## Profiling Setup

This server is designed to work with eBPF profilers like Parca Agent. The workload patterns include:

1. **Fibonacci calculations** (recursive, stack-heavy)
2. **Prime number searches** (CPU-intensive loops)
3. **Matrix multiplication** (memory allocation and computation)
4. **Intermittent sleeps** (varying activity patterns)

### Source Map Configuration

- TypeScript compiled with `sourceMap: true`
- Source files included in container at `/app/src`
- JavaScript with source maps at `/app/dist`
- Source maps reference original TypeScript files

## Cleanup

```bash
# Remove Kubernetes resources
kubectl delete -f k8s-deployment.yaml

# Remove Docker image
docker rmi sample-ts-server:latest
```
