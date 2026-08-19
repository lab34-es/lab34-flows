jest.mock('yargs-parser', () => () => ({}));

// A fake broker: connect() hands back an EventEmitter-ish client whose
// subscribe/end are spies, so start/stop/test can be driven without a network.
const clients: any[] = [];

const makeClient = (opts: any, subscribeImpl?: any, failWith?: Error) => {
  const handlers: Record<string, Array<(...args: any[]) => void>> = {};
  const client: any = {
    opts,
    on: jest.fn((event, fn) => { (handlers[event] ||= []).push(fn); return client; }),
    emit: (event: string, ...args: any[]) => (handlers[event] || []).forEach(fn => fn(...args)),
    subscribe: jest.fn(subscribeImpl || ((topic: string, cb: (error: Error | null) => void) => cb(null))),
    end: jest.fn()
  };
  clients.push(client);
  // Settle on the next tick so the caller can attach its handlers first.
  setImmediate(() => (failWith ? client.emit('error', failWith) : client.emit('connect')));
  return client;
};

jest.mock('mqtt', () => ({ connect: jest.fn((opts) => makeClient(opts)) }));

import fs from 'fs';
import mqtt from 'mqtt';
import * as latentMqtt from '../../src/latentApplications/mqtt';

const lastClient = () => clients[clients.length - 1];

beforeEach(() => {
  jest.clearAllMocks();
  clients.length = 0;
});

describe('mqtt.start', () => {
  test('connects with the host, client id and default protocol', async () => {
    await latentMqtt.start({}, { client: 'c1', connection: { host: 'broker' } });

    expect(mqtt.connect).toHaveBeenCalledWith(expect.objectContaining({
      host: 'broker', clientId: 'c1', protocol: 'mqtt'
    }));
  });

  test('an explicit protocol wins', async () => {
    await latentMqtt.start({}, { client: 'c2', connection: { host: 'b', protocol: 'mqtts' } });
    expect((mqtt.connect as jest.Mock).mock.calls[0][0].protocol).toBe('mqtts');
  });

  test('TLS material is read off disk when configured', async () => {
    const read = jest.spyOn(fs, 'readFileSync').mockReturnValue('PEM' as any);

    await latentMqtt.start({}, {
      client: 'c3',
      connection: { host: 'b', key: '/k.pem', cert: '/c.pem', ca: '/ca.pem' }
    });

    const opts = (mqtt.connect as jest.Mock).mock.calls[0][0];
    expect(opts).toEqual(expect.objectContaining({ key: 'PEM', cert: 'PEM', ca: 'PEM' }));
    expect(read).toHaveBeenCalledTimes(3);
    read.mockRestore();
  });

  test('subscribes to a single topic', async () => {
    await latentMqtt.start({}, {
      client: 'c4', connection: { host: 'b' }, subscribe: { topic: 'orders' }
    });
    expect(lastClient().subscribe).toHaveBeenCalledWith('orders', expect.any(Function));
  });

  test('subscribes to a list of topics', async () => {
    await latentMqtt.start({}, {
      client: 'c5', connection: { host: 'b' }, subscribe: [{ topic: 'a' }, { topic: 'b' }]
    });
    expect(lastClient().subscribe).toHaveBeenCalledTimes(2);
  });

  test('a failing subscription rejects', async () => {
    (mqtt.connect as jest.Mock).mockImplementationOnce((opts) =>
      makeClient(opts, (topic: string, cb: (error: Error | null) => void) => cb(new Error('denied'))));

    await expect(latentMqtt.start({}, {
      client: 'c6', connection: { host: 'b' }, subscribe: { topic: 'x' }
    })).rejects.toThrow('denied');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Error subscribing'));
  });

  test('a connection error rejects and is logged', async () => {
    (mqtt.connect as jest.Mock).mockImplementationOnce((opts) =>
      makeClient(opts, undefined, new Error('refused')));

    await expect(latentMqtt.start({}, { client: 'c7', connection: { host: 'b' } }))
      .rejects.toThrow('refused');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Error connecting'));
  });

  test('starting the same client id again reuses the instance', async () => {
    await latentMqtt.start({}, { client: 'shared', connection: { host: 'b' } });
    (mqtt.connect as jest.Mock).mockClear();

    await latentMqtt.start({}, { client: 'shared', connection: { host: 'b' } });
    expect(mqtt.connect).not.toHaveBeenCalled();

    latentMqtt.stop('shared');
  });
});

describe('mqtt.test', () => {
  beforeEach(async () => {
    await latentMqtt.start({}, { client: 'tester', connection: { host: 'b' } });
    lastClient().emit('message', 'orders', Buffer.from(JSON.stringify({ id: 1, status: 'paid' })));
  });

  afterEach(() => latentMqtt.stop('tester'));

  test('resolves with nothing unmatched when the message arrived', async () => {
    await expect(latentMqtt.test({}, {
      client: 'tester', test: [{ topic: 'orders', message: { id: 1 } }]
    }, {})).resolves.toEqual([]);
  });

  test('matches on a subset of the payload keys', async () => {
    await expect(latentMqtt.test({}, {
      client: 'tester', test: [{ topic: 'orders', message: { status: 'paid' } }]
    }, {})).resolves.toEqual([]);
  });

  test('reports a message that never arrived', async () => {
    const notMatched: any = await latentMqtt.test({}, {
      client: 'tester', test: [{ topic: 'shipments', message: { id: 9 } }]
    }, {});
    expect(notMatched).toEqual([{ topic: 'shipments', message: { id: 9 } }]);
  });

  test('a payload mismatch on the right topic is reported', async () => {
    const notMatched: any = await latentMqtt.test({}, {
      client: 'tester', test: [{ topic: 'orders', message: { id: 999 } }]
    }, {});
    expect(notMatched).toHaveLength(1);
  });

  test('an unknown client rejects', async () => {
    await expect(latentMqtt.test({}, { client: 'ghost', test: [] }, {}))
      .rejects.toThrow(/does not exist or is not connected/);
  });

  test('retries the configured number of times before giving up', async () => {
    jest.useFakeTimers();
    const pending = latentMqtt.test({}, {
      client: 'tester',
      test: [{ topic: 'never', message: {} }],
      retry: { attempts: 3, delay: 1 }
    }, {});

    await jest.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toHaveLength(1);
    jest.useRealTimers();
  });
});

describe('mqtt.stop', () => {
  test('ends the connection and forgets the instance', async () => {
    await latentMqtt.start({}, { client: 'closer', connection: { host: 'b' } });
    const client = lastClient();

    latentMqtt.stop('closer');

    expect(client.end).toHaveBeenCalled();
    await expect(latentMqtt.test({}, { client: 'closer', test: [] }, {})).rejects.toThrow();
  });

  test('stopping an unknown client is a no-op', () => {
    expect(() => latentMqtt.stop('never-started')).not.toThrow();
  });
});
