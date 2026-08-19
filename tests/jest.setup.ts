// Global test configuration.

// Silence the console the tests drive, while keeping the calls assertable.
//
// Spying on each method rather than replacing `global.console` wholesale
// matters: with `jest --silent`, jest installs its own console object *after*
// this file is evaluated, so a replaced global would be thrown away and every
// assertion against console.log would break. Re-spying per test attaches to
// whichever console object is current.
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
  jest.spyOn(console, 'trace').mockImplementation(() => {});
});

// Set test timeout
jest.setTimeout(10000);

// Stop a helper that exits on failure from taking the test run down with it.
process.exit = jest.fn() as unknown as typeof process.exit;

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
