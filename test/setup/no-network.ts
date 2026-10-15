// Runs before every test file (vitest.config.ts `setupFiles`). Tests never reach a network (global constraint
// 10): `fetch` is replaced by a function that throws, and so is `net.Socket.prototype.connect`, which every
// TCP client in Node goes through (net.connect, tls.connect, http and https agents, undici's fetch and
// WebSocket). The throw is synchronous and happens before a socket opens. Only `npm ci` in CI touches the
// registry; the tests themselves never do.
import net from 'node:net';

const MESSAGE = 'network access is refused in tests (test/setup/no-network.ts)';

function refuse(what: string): never {
  throw new Error(`${MESSAGE}: ${what}`);
}

Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: function fetch(): never {
    return refuse('fetch');
  },
});

net.Socket.prototype.connect = function connect(): never {
  return refuse('net.Socket.prototype.connect');
};
