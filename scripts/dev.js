const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('--- Starting LSIP Development Environment ---');

// 1. Compile Main process files once before running
try {
  console.log('Compiling Main and Preload TypeScript files...');
  execSync('npx tsc -p tsconfig.main.json', { stdio: 'inherit' });
  console.log('Main compilation successful.');
} catch (err) {
  console.error('Initial main compilation failed. Starting anyway...');
}

// 2. Start Vite Dev Server
console.log('Starting Vite Dev Server for React...');
const viteProcess = spawn('npx', ['vite'], {
  shell: true,
  stdio: 'inherit',
});

// 3. Watch and Compile Main Process files concurrently
console.log('Watching Main and Preload files for changes...');
const tscProcess = spawn('npx', ['tsc', '-w', '-p', 'tsconfig.main.json'], {
  shell: true,
  stdio: 'inherit',
});

// Wait 3 seconds for Vite server to boot up, then launch Electron
setTimeout(() => {
  console.log('Launching Electron...');
  
  const electronEnv = { ...process.env, NODE_ENV: 'development' };
  const electronProcess = spawn('npx', ['electron', '.'], {
    shell: true,
    stdio: 'inherit',
    env: electronEnv,
  });

  electronProcess.on('exit', () => {
    console.log('Electron process exited. Cleaning up...');
    cleanup();
  });
}, 3000);

function cleanup() {
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM node.exe /T', { stdio: 'ignore' });
    } else {
      viteProcess.kill();
      tscProcess.kill();
    }
  } catch (e) {
    // ignore cleanup errors
  }
  process.exit(0);
}

// Handle parent exit
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
