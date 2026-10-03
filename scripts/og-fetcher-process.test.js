import { describe, expect, test } from '@jest/globals';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

async function fetchInProcess(imageFailure) {
  const requests = [];
  const server = createServer((request, response) => {
    requests.push(request.url);
    if (imageFailure && request.url === '/page') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<meta property="og:title" content="Fixture"><meta property="og:image" content="/image">');
    } else {
      response.writeHead(503, { 'content-type': 'text/plain' });
      response.write('body left open');
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/page`;
  const script = `
    import { fetchOGMetadata } from ${JSON.stringify(new URL('./og-fetcher.js', import.meta.url).href)};
    console.log('RESULT:' + JSON.stringify(await fetchOGMetadata(process.argv[1], {})));
  `;
  const start = performance.now();
  const child = spawn(process.execPath, ['--input-type=module', '-e', script, url]);
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, 3000);
  try {
    const [code, signal] = await once(child, 'close');
    const resultLine = stdout.split('\n').find(line => line.startsWith('RESULT:'));
    return {
      code, signal, timedOut, stderr, requests,
      elapsed: performance.now() - start,
      result: resultLine ? JSON.parse(resultLine.slice('RESULT:'.length)) : undefined,
    };
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null && child.signalCode === null) { child.kill(); }
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

describe('Cycle HTTP OG et sortie naturelle du processus', () => {
  test('une page HTTP en erreur ne conserve pas son corps ouvert', async () => {
    const result = await fetchInProcess(false);
    expect(result).toMatchObject({ code: 0, signal: null, timedOut: false });
    expect(result.elapsed).toBeLessThan(3000);
    expect(result.result).toEqual({ meta: null, fromCache: false, failed: true });
  });

  test('une image HTTP en erreur ne retient pas la page valide', async () => {
    const result = await fetchInProcess(true);
    expect(result).toMatchObject({ code: 0, signal: null, timedOut: false });
    expect(result.elapsed).toBeLessThan(3000);
    expect(result.requests).toEqual(['/page', '/image']);
    expect(result.result).toMatchObject({ meta: { ogTitle: 'Fixture' }, fromCache: false });
  });
});
