// No test reaches a network (docserver L1, Task 1; global constraint 10). The setup file
// test/setup/no-network.ts replaces `fetch` and `net.Socket.prototype.connect` before any test file loads,
// so every TCP path (net, tls, http, https, undici's fetch, WebSocket) throws before a socket opens.
// Each case below calls a real API at the discard port on loopback, so a missing stub is a red, never a hang.
import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import { describe, expect, it } from 'vitest';

const REFUSED = /network access is refused in tests/;
const LOOPBACK = { host: '127.0.0.1', port: 9 } as const;

describe('no network in tests', () => {
  it('fetch() throws synchronously from the setup stub', () => {
    expect(() => fetch(`http://${LOOPBACK.host}:${LOOPBACK.port}/`)).toThrow(REFUSED);
  });

  it('net.connect() throws', () => {
    expect(() => net.connect(LOOPBACK)).toThrow(REFUSED);
  });

  it('net.createConnection() throws', () => {
    expect(() => net.createConnection(LOOPBACK)).toThrow(REFUSED);
  });

  it('a bare net.Socket cannot connect', () => {
    expect(() => new net.Socket().connect(LOOPBACK)).toThrow(REFUSED);
  });

  it('tls.connect() throws', () => {
    expect(() => tls.connect(LOOPBACK)).toThrow(REFUSED);
  });

  it('http.get() throws', () => {
    expect(() => http.get(`http://${LOOPBACK.host}:${LOOPBACK.port}/`)).toThrow(REFUSED);
  });
});
