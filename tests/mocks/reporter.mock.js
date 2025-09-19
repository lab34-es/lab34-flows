// Mock implementation of the reporter module

const createReporterMock = () => {
  return {
    stepStart: jest.fn(),
    stepUpdate: jest.fn(),
    mimicStart: jest.fn(),
    request: jest.fn(),
    mimicRequest: jest.fn(),
    mimicResponse: jest.fn(),
    mimicResponseBody: jest.fn(),
    mimicFile: jest.fn(),
    response: jest.fn(),
    test: jest.fn(),
    playwrightStep: jest.fn(),
    execution: jest.fn(),
    diagram: jest.fn(),
    stepTestError: jest.fn(),
    server: {
      emit: jest.fn()
    }
  };
};

module.exports = {
  createReporterMock
};
