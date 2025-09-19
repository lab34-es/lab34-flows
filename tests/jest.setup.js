// Jest setup file for global test configuration

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Set test timeout
jest.setTimeout(10000);

// Mock process.exit to prevent tests from exiting
process.exit = jest.fn();

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
