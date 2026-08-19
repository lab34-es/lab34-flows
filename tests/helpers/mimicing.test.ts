jest.mock('yargs-parser', () => () => ({}));
jest.mock('../../src/helpers/paths');

import fs from 'fs';
import * as paths from '../../src/helpers/paths';
import * as mimicing from '../../src/helpers/mimicing';

const step = (...applications: string[]) => ({
  mimic: applications.map(application => ({ application }))
});

beforeEach(() => {
  jest.clearAllMocks();
  (paths.contextDir as jest.Mock).mockImplementation(
    async (parts: string[]) => `/ctx/${parts.join('/')}`
  );
});

describe('mimicing.validate', () => {
  test('true when every mimic file is present', async () => {
    const exists = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    await expect(mimicing.validate([step('calculator')])).resolves.toBe(true);
    expect(paths.contextDir).toHaveBeenCalledWith(['applications', 'calculator']);
    exists.mockRestore();
  });

  test('deduplicates the applications across steps', async () => {
    const exists = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    await mimicing.validate([step('calculator'), step('calculator', 'httpbin')]);
    expect(paths.contextDir).toHaveBeenCalledTimes(2);
    exists.mockRestore();
  });

  test('steps with no mimic block contribute nothing', async () => {
    await expect(mimicing.validate([{}, { mimic: [] }])).resolves.toBe(true);
    expect(paths.contextDir).not.toHaveBeenCalled();
  });

  test('false, with a message, when a mimic file is missing', async () => {
    const exists = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    await expect(mimicing.validate([step('calculator')])).resolves.toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('has no mimic file'));
    exists.mockRestore();
  });

  test('a path resolution failure is reported, not thrown', async () => {
    (paths.contextDir as jest.Mock).mockRejectedValue(new Error('no home'));
    await expect(mimicing.validate([step('calculator')])).resolves.toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error validating mimic files'));
  });
});

describe('mimicing.load', () => {
  test('returns an empty map when nothing is mimicked', async () => {
    await expect(mimicing.load([{}])).resolves.toEqual({});
  });

  test('exits when a mimic file is missing', async () => {
    const exists = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    await mimicing.load([step('calculator')]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('has no mimic file'));
    expect(process.exit).toHaveBeenCalledWith(1);
    exists.mockRestore();
  });

  test('a path resolution failure is reported and exits', async () => {
    (paths.contextDir as jest.Mock).mockRejectedValue(new Error('boom'));
    await mimicing.load([step('calculator')]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error loading mimic files'));
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

describe('mimicing.startStep', () => {
  const mimicApp = () => ({ start: jest.fn().mockResolvedValue('started'), stop: jest.fn() });

  test('starts each mimicked application with the flow attached', async () => {
    const calculator = mimicApp();
    const reporter = { mimicStart: jest.fn() };
    const flow = { reporter };

    await mimicing.startStep({ calculator }, { mimic: [{ application: 'calculator', port: 4000 }] }, flow);

    expect(calculator.start).toHaveBeenCalledWith({ flow, application: 'calculator', port: 4000 });
  });

  test('announces the batch once and then each application', async () => {
    const calculator = mimicApp();
    const reporter = { mimicStart: jest.fn() };

    await mimicing.startStep({ calculator }, { mimic: [{ application: 'calculator' }] }, { reporter });

    expect(reporter.mimicStart).toHaveBeenCalledTimes(2);
    expect(reporter.mimicStart).toHaveBeenNthCalledWith(1);
    expect(reporter.mimicStart).toHaveBeenNthCalledWith(2, { application: 'calculator' });
  });

  test('a step with no mimic block starts nothing and announces nothing', async () => {
    const reporter = { mimicStart: jest.fn() };
    await expect(mimicing.startStep({}, {}, { reporter })).resolves.toEqual([]);
    expect(reporter.mimicStart).not.toHaveBeenCalled();
  });

  test('an empty mimic list announces nothing', async () => {
    const reporter = { mimicStart: jest.fn() };
    await mimicing.startStep({}, { mimic: [] }, { reporter });
    expect(reporter.mimicStart).not.toHaveBeenCalled();
  });
});

describe('mimicing.stopStep', () => {
  test('stops every mimicked application', async () => {
    const calculator = { stop: jest.fn().mockResolvedValue(undefined) };
    await mimicing.stopStep({ calculator }, { mimic: [{ application: 'calculator', port: 4000 }] });
    expect(calculator.stop).toHaveBeenCalledWith({ application: 'calculator', port: 4000 });
  });

  test('a step with no mimic block stops nothing', async () => {
    await expect(mimicing.stopStep({}, {})).resolves.toEqual([]);
  });
});
