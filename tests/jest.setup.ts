// Jest setup file for global test configuration

// Mock console methods to reduce noise during tests. The mock is partial, so
// it is cast rather than satisfying the whole Console interface.
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
} as unknown as Console;

// Set test timeout
jest.setTimeout(10000);

// Mock process.exit to prevent tests from exiting
process.exit = jest.fn() as unknown as typeof process.exit;

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
