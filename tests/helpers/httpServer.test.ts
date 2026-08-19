jest.mock('yargs-parser', () => () => ({}));

import request from 'supertest';
import * as httpServer from '../../src/helpers/httpServer';

const reporter = () => ({
  mimicRequest: jest.fn(),
  mimicResponse: jest.fn(),
  mimicResponseBody: jest.fn()
});

const mimicConfig = (application: string, rep = reporter()) => ({
  application,
  flow: { reporter: rep }
});

// Each test claims its own port so the module-level registry stays predictable.
let nextPort = 45_000;
const takePort = () => nextPort++;

const started: Array<{ server: any }> = [];

afterEach(async () => {
  await Promise.all(started.splice(0).map(s => new Promise<void>(resolve => s.server.close(() => resolve()))));
});

describe('httpServer.start', () => {
  test('serves the callback\'s response and reports the exchange', async () => {
    const rep = reporter();
    const port = takePort();

    const server: any = await httpServer.start(mimicConfig('calculator', rep), port, (req, res) => {
      res.json({ sum: 3 });
    });
    started.push({ server });

    const res = await request(`http://127.0.0.1:${port}`).post('/add').send({ a: 1, b: 2 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sum: 3 });
    expect(rep.mimicRequest).toHaveBeenCalledWith('calculator', '/add', expect.objectContaining({
      method: 'POST',
      body: { a: 1, b: 2 }
    }));
    expect(rep.mimicResponse).toHaveBeenCalledWith('calculator', '/add');
    expect(rep.mimicResponseBody).toHaveBeenCalledWith({ sum: 3 });
  });

  test('resolves with an http server that is listening', async () => {
    const port = takePort();
    const server: any = await httpServer.start(mimicConfig('httpbin'), port, (req, res) => res.json({}));
    started.push({ server });

    expect(server).toBeDefined();
    expect(typeof server.close).toBe('function');
    expect(server.listening).toBe(true);
  });

  test('starting the same application and port again reuses the running server', async () => {
    const port = takePort();
    const first: any = await httpServer.start(mimicConfig('reused'), port, (req, res) => res.json({ n: 1 }));
    started.push({ server: first });

    const second: any = await httpServer.start(mimicConfig('reused'), port, (req, res) => res.json({ n: 2 }));

    expect(second).toBe(first);
    const res = await request(`http://127.0.0.1:${port}`).get('/');
    expect(res.body).toEqual({ n: 1 });
  });

  test('templated responses are rendered against the request body', async () => {
    const port = takePort();
    const server: any = await httpServer.start(mimicConfig('templated'), port, (req, res) => {
      res.json({ echoed: '{{name}}' });
    });
    started.push({ server });

    const res = await request(`http://127.0.0.1:${port}`).post('/').send({ name: 'ana' });
    expect(res.body).toEqual({ echoed: 'ana' });
  });

  test('urlencoded bodies are parsed too', async () => {
    const port = takePort();
    const rep = reporter();
    const server: any = await httpServer.start(mimicConfig('form', rep), port, (req, res) => res.json({ ok: true }));
    started.push({ server });

    await request(`http://127.0.0.1:${port}`).post('/form').type('form').send({ a: '1' });
    expect(rep.mimicRequest).toHaveBeenCalledWith('form', '/form', expect.objectContaining({ body: { a: '1' } }));
  });
});

describe('httpServer.stop', () => {
  test('stopping an id that was never started resolves quietly', async () => {
    await expect(httpServer.stop('not-a-server')).resolves.toBeUndefined();
  });
});
