import * as http from 'http';

const PORT = process.env.PORT || 3000;

// Global state
let server: http.Server;
let isRunning = true;

// Request handler
function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({status: 'healthy', timestamp: Date.now()}));
  } else {
    res.writeHead(404);
    res.end('Not Found!!!!!!');
  }
}

// Computation functions
function computeFibonacci(n: number): number {
  if (n <= 1) return n;
  return computeFibonacci(n - 1) + computeFibonacci(n - 2);
}

function checkPrime(num: number): boolean {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;

  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}

function findPrimesInRange(start: number, end: number): number[] {
  const primes: number[] = [];
  for (let i = start; i <= end; i++) {
    if (checkPrime(i)) {
      primes.push(i);
    }
  }
  return primes;
}

function multiplyMatrices(size: number): number[][] {
  const a = Array(size)
    .fill(0)
    .map(() =>
      Array(size)
        .fill(0)
        .map(() => Math.random())
    );
  const b = Array(size)
    .fill(0)
    .map(() =>
      Array(size)
        .fill(0)
        .map(() => Math.random())
    );
  const result = Array(size)
    .fill(0)
    .map(() => Array(size).fill(0));

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      for (let k = 0; k < size; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runComputationLoop(): Promise<void> {
  let iteration = 0;

  while (isRunning) {
    iteration++;
    console.log(`Starting computation iteration ${iteration} at ${new Date().toISOString()}`);

    // Fibonacci computation (CPU intensive)
    const fibStart = Date.now();
    const fibResult = computeFibonacci(30 + (iteration % 5));
    console.log(
      `Fibonacci(${30 + (iteration % 5)}) = ${fibResult} (took ${Date.now() - fibStart}ms)`
    );

    // Short sleep
    await sleep(100);

    // Prime number search (CPU intensive)
    const primeStart = Date.now();
    const rangeStart = 1000 + iteration * 100;
    const rangeEnd = rangeStart + 500;
    const primes = findPrimesInRange(rangeStart, rangeEnd);
    console.log(
      `Found ${primes.length} primes in range ${rangeStart}-${rangeEnd} (took ${
        Date.now() - primeStart
      }ms)`
    );

    // Short sleep
    await sleep(150);

    // Matrix multiplication (memory and CPU intensive)
    const matrixStart = Date.now();
    const matrixSize = 50 + (iteration % 20);
    multiplyMatrices(matrixSize);
    console.log(
      `Matrix multiplication ${matrixSize}x${matrixSize} completed (took ${
        Date.now() - matrixStart
      }ms)`
    );

    // Longer sleep between iterations
    await sleep(500);
  }
}

function startServer(): Promise<void> {
  return new Promise(resolve => {
    server = http.createServer(handleRequest);
    server.listen(PORT, () => {
      console.log(`TypeScript computation server listening on port ${PORT}`);
      console.log(`Health endpoint available at http://localhost:${PORT}/health`);
      resolve();
    });
  });
}

function stopServer(): void {
  isRunning = false;
  if (server) {
    server.close();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  stopServer();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  stopServer();
  process.exit(0);
});

// Start server and computation loop
async function main() {
  try {
    await startServer();
    console.log('Starting continuous computation loop...');
    await runComputationLoop();
  } catch (error) {
    console.error('Server error:', error);
    process.exit(1);
  }
}

main();
