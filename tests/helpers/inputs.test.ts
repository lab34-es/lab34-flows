jest.mock('yargs-parser', () => () => ({}));

import * as inputs from '../../src/helpers/inputs';

/** A UI reporter: it records what it was told rather than printing it. */
const uiReporter = () => ({
  cli: false,
  server: { emit: jest.fn() },
  inputRequest: jest.fn(),
  inputResolved: jest.fn()
});

afterEach(() => {
  inputs.cancelAll('test teardown');
});

describe('inputs.text - from the UI', () => {
  test('reports the request and waits for the answer', async () => {
    const reporter = uiReporter();

    const pending = inputs.text(
      { reporter, stepId: 'tester-waitForText-0' },
      { label: 'Introduce the barcode to be reserved' }
    );

    expect(reporter.inputRequest).toHaveBeenCalledTimes(1);
    const request = reporter.inputRequest.mock.calls[0][0];
    expect(request).toMatchObject({
      kind: 'text',
      label: 'Introduce the barcode to be reserved',
      stepId: 'tester-waitForText-0',
      secret: false
    });
    expect(inputs.list()).toHaveLength(1);

    expect(inputs.answer(request.id, '  1234567890123 ')).toBe(true);

    await expect(pending).resolves.toBe('1234567890123');
    expect(reporter.inputResolved).toHaveBeenCalledWith(request);
    expect(inputs.list()).toHaveLength(0);
  });

  test('cancelling fails the step that asked', async () => {
    const reporter = uiReporter();

    const pending = inputs.text({ reporter, stepId: 'step-1' });
    const { id } = reporter.inputRequest.mock.calls[0][0];

    expect(inputs.cancel(id, 'Input was cancelled')).toBe(true);

    await expect(pending).rejects.toThrow('Input was cancelled');
  });

  test('cancelAll ends every request left waiting', async () => {
    const reporter = uiReporter();

    const first = inputs.text({ reporter });
    const second = inputs.text({ reporter });

    expect(inputs.list()).toHaveLength(2);

    inputs.cancelAll('The flow finished before the input was answered');

    await expect(first).rejects.toThrow('The flow finished');
    await expect(second).rejects.toThrow('The flow finished');
    expect(inputs.list()).toHaveLength(0);
  });

  test('answering something nobody is waiting for says so', () => {
    expect(inputs.answer('not-a-request', 'x')).toBe(false);
    expect(inputs.cancel('not-a-request')).toBe(false);
  });
});

describe('inputs.text - from the CLI', () => {
  test('reads the terminal instead of reporting a request', async () => {
    const reporter = { ...uiReporter(), cli: true };
    const write = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    const once = jest.spyOn(process.stdin, 'once')
      .mockImplementation((_event: any, listener: any) => {
        listener(Buffer.from('AC001\n'));
        return process.stdin;
      });

    await expect(inputs.text({ reporter }, { label: 'AC code' })).resolves.toBe('AC001');

    expect(reporter.inputRequest).not.toHaveBeenCalled();
    expect(write.mock.calls[0][0]).toContain('AC code');

    write.mockRestore();
    once.mockRestore();
  });
});
