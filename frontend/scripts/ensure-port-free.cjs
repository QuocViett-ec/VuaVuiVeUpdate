#!/usr/bin/env node

const net = require('node:net');

const portArg = Number.parseInt(process.argv[2], 10);
const appName = process.argv[3] || 'app';

if (!Number.isInteger(portArg) || portArg <= 0 || portArg > 65535) {
  console.error('Invalid port. Usage: node scripts/ensure-port-free.cjs <port> [name]');
  process.exit(1);
}

const hosts = ['127.0.0.1', '::1'];

function isPortOpenOnHost(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });

    socket.setTimeout(750);

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', (err) => {
      const freeCodes = ['ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'EADDRNOTAVAIL'];
      resolve(!freeCodes.includes(err.code));
    });
  });
}

(async () => {
  const checks = await Promise.all(hosts.map((host) => isPortOpenOnHost(portArg, host)));
  const isInUse = checks.some(Boolean);

  if (isInUse) {
    console.error(`[${appName}] Port ${portArg} is already in use.`);
    console.error(`Stop the process using port ${portArg} and run again.`);
    process.exit(1);
  }

  process.exit(0);
})();
