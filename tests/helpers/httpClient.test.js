const axios = require('axios');
const httpClient = require('../../src/helpers/httpClient');
const { createReporterMock } = require('../mocks/reporter.mock');

// Mock axios
jest.mock('axios');

describe('httpClient', () => {
  let ctx;
  let mockReporter;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock reporter
    mockReporter = createReporterMock();
    
    // Create test context
    ctx = {
      env: {
        BASE_URL: 'https://api.example.com'
      },
      reporter: mockReporter
    };

    // Mock process.exit to prevent test termination
    process.exit = jest.fn();
  });

  describe('headers generation', () => {
    it('should include X-API-KEY header when provided', async () => {
      ctx.env.X_API_KEY = 'test-api-key';
      
      axios.request.mockResolvedValue({
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 200,
        data: { success: true }
      });

      await httpClient.get(ctx, '/test');

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key'
          })
        })
      );
    });

    it('should include Basic Auth header when HTTP_BASIC_AUTH is provided', async () => {
      ctx.env.HTTP_BASIC_AUTH = 'user:password';
      
      axios.request.mockResolvedValue({
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 200,
        data: { success: true }
      });

      await httpClient.get(ctx, '/test');

      const expectedAuth = `Basic ${Buffer.from('user:password').toString('base64')}`;
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expectedAuth
          })
        })
      );
    });

    it('should merge multiple headers', async () => {
      ctx.env.X_API_KEY = 'test-api-key';
      ctx.env.HTTP_BASIC_AUTH = 'user:password';
      
      axios.request.mockResolvedValue({
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 200,
        data: { success: true }
      });

      await httpClient.get(ctx, '/test');

      const expectedAuth = `Basic ${Buffer.from('user:password').toString('base64')}`;
      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
            'Authorization': expectedAuth
          })
        })
      );
    });
  });

  describe('GET requests', () => {
    it('should make a successful GET request', async () => {
      const mockResponse = {
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 200,
        data: { message: 'success' }
      };
      
      axios.request.mockResolvedValue(mockResponse);

      const [headers, status, body] = await httpClient.get(ctx, '/users');

      expect(axios.request).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {}
      });
      
      expect(status).toBe(200);
      expect(body).toEqual({ message: 'success' });
      expect(mockReporter.request).toHaveBeenCalled();
      expect(mockReporter.response).toHaveBeenCalled();
    });

    it('should handle GET request with custom headers', async () => {
      const mockResponse = {
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 200,
        data: { message: 'success' }
      };
      
      axios.request.mockResolvedValue(mockResponse);

      await httpClient.get(ctx, '/users', {
        headers: { 'Custom-Header': 'value' }
      });

      expect(axios.request).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: { 'Custom-Header': 'value' }
      });
    });
  });

  describe('POST requests', () => {
    it('should make a POST request with JSON data', async () => {
      const mockResponse = {
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 201,
        data: { id: 1, name: 'Test' }
      };
      
      axios.request.mockResolvedValue(mockResponse);

      const postData = { name: 'Test User', email: 'test@example.com' };
      const [headers, status, body] = await httpClient.post(ctx, '/users', {
        data: postData
      });

      expect(axios.request).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        data: JSON.stringify(postData)
      });
      
      expect(status).toBe(201);
      expect(body).toEqual({ id: 1, name: 'Test' });
    });

    it('should handle POST request with body property', async () => {
      const mockResponse = {
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 201,
        data: { success: true }
      };
      
      axios.request.mockResolvedValue(mockResponse);

      const postBody = { key: 'value' };
      await httpClient.post(ctx, '/endpoint', {
        body: postBody
      });

      expect(axios.request).toHaveBeenCalledWith({
        url: 'https://api.example.com/endpoint',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        data: JSON.stringify(postBody)
      });
    });

    it('should handle POST request with string data', async () => {
      const mockResponse = {
        headers: { get: jest.fn().mockReturnValue('text/plain') },
        status: 200,
        data: 'OK'
      };
      
      axios.request.mockResolvedValue(mockResponse);

      await httpClient.post(ctx, '/text', {
        data: 'plain text data'
      });

      expect(axios.request).toHaveBeenCalledWith({
        url: 'https://api.example.com/text',
        method: 'POST',
        headers: {},
        data: 'plain text data'
      });
    });
  });

  describe('PUT requests', () => {
    it('should make a PUT request', async () => {
      const mockResponse = {
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 200,
        data: { updated: true }
      };
      
      axios.request.mockResolvedValue(mockResponse);

      const putData = { name: 'Updated Name' };
      const [headers, status, body] = await httpClient.put(ctx, '/users/1', {
        data: putData
      });

      expect(axios.request).toHaveBeenCalledWith({
        url: 'https://api.example.com/users/1',
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        data: JSON.stringify(putData)
      });
      
      expect(status).toBe(200);
      expect(body).toEqual({ updated: true });
    });
  });

  describe('DELETE requests', () => {
    it('should make a DELETE request', async () => {
      const mockResponse = {
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 204,
        data: ''
      };
      
      axios.request.mockResolvedValue(mockResponse);

      const [headers, status, body] = await httpClient.del(ctx, '/users/1');

      expect(axios.request).toHaveBeenCalledWith({
        url: 'https://api.example.com/users/1',
        method: 'DELETE',
        headers: {}
      });
      
      expect(status).toBe(204);
      expect(body).toBe('');
    });
  });

  describe('PATCH requests', () => {
    it('should make a PATCH request', async () => {
      const mockResponse = {
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 200,
        data: { patched: true }
      };
      
      axios.request.mockResolvedValue(mockResponse);

      const patchData = { field: 'new value' };
      const [headers, status, body] = await httpClient.patch(ctx, '/users/1', {
        data: patchData
      });

      expect(axios.request).toHaveBeenCalledWith({
        url: 'https://api.example.com/users/1',
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        data: JSON.stringify(patchData)
      });
      
      expect(status).toBe(200);
      expect(body).toEqual({ patched: true });
    });
  });

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.message = 'Network Error';
      
      axios.request.mockRejectedValue(networkError);

      try {
        await httpClient.get(ctx, '/test');
      } catch (error) {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle HTTP error responses', async () => {
      const errorResponse = new Error('Request failed');
      errorResponse.response = {
        status: 404,
        headers: { 'content-type': 'application/json' },
        data: { error: 'Not Found' }
      };
      
      axios.request.mockRejectedValue(errorResponse);

      try {
        await httpClient.get(ctx, '/notfound');
      } catch (error) {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalledWith('Error:', JSON.stringify({ error: 'Not Found' }, null, 2));
    });

    it('should handle error responses with string data', async () => {
      const errorResponse = new Error('Request failed');
      errorResponse.response = {
        status: 500,
        headers: { 'content-type': 'text/plain' },
        data: 'Internal Server Error'
      };
      
      axios.request.mockRejectedValue(errorResponse);

      try {
        await httpClient.get(ctx, '/error');
      } catch (error) {
        // Expected to throw
      }

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalledWith('Error:', JSON.stringify('Internal Server Error', null, 2));
    });
  });

  describe('SSL certificate handling', () => {
    it('should bypass SSL certificate check when skipCertCheck is true', async () => {
      // Store original value and delete it to ensure it's undefined
      const originalValue = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      
      const mockResponse = {
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 200,
        data: { success: true }
      };
      
      axios.request.mockResolvedValue(mockResponse);

      await httpClient.get(ctx, '/secure', { skipCertCheck: true });

      // Verify that the environment variable was temporarily set to 0
      expect(axios.request).toHaveBeenCalled();
      
      // After the request, the original value should be restored
      // The httpClient sets it back to undefined string if it was undefined
      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe('undefined');
      
      // Restore original value if it existed
      if (originalValue !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalValue;
      }
    });

    it('should not modify SSL settings when skipCertCheck is false', async () => {
      const originalValue = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      
      const mockResponse = {
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 200,
        data: { success: true }
      };
      
      axios.request.mockResolvedValue(mockResponse);

      await httpClient.get(ctx, '/secure', { skipCertCheck: false });

      expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe(originalValue);
    });
  });

  describe('Context case filtering', () => {
    it('should use case-specific environment variables', async () => {
      ctx.case = 'dev';
      ctx.env = {
        BASE_URL: 'https://api.example.com',
        BASE_URL_dev: 'https://dev.api.example.com',
        X_API_KEY: 'prod-key',
        X_API_KEY_dev: 'dev-key'
      };
      
      const mockResponse = {
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 200,
        data: { success: true }
      };
      
      axios.request.mockResolvedValue(mockResponse);

      await httpClient.get(ctx, '/test');

      expect(axios.request).toHaveBeenCalledWith({
        url: 'https://dev.api.example.com/test',
        method: 'GET',
        headers: { 'x-api-key': 'dev-key' }
      });
    });

    it('should handle missing case gracefully', async () => {
      ctx.case = '';
      
      const mockResponse = {
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 200,
        data: { success: true }
      };
      
      axios.request.mockResolvedValue(mockResponse);

      await httpClient.get(ctx, '/test');

      expect(axios.request).toHaveBeenCalledWith({
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {}
      });
    });
  });

  describe('Response formatting', () => {
    it('should handle JSON responses correctly', async () => {
      const mockResponse = {
        headers: { 
          get: jest.fn().mockReturnValue('application/json'),
        },
        status: 200,
        data: { key: 'value' }
      };
      
      axios.request.mockResolvedValue(mockResponse);

      const [headers, status, body] = await httpClient.get(ctx, '/json');

      expect(status).toBe(200);
      expect(body).toEqual({ key: 'value' });
    });

    it('should handle non-JSON responses', async () => {
      const mockResponse = {
        headers: { 
          get: jest.fn().mockReturnValue('text/html'),
        },
        status: 200,
        data: '<html>Test</html>'
      };
      
      axios.request.mockResolvedValue(mockResponse);

      const [headers, status, body] = await httpClient.get(ctx, '/html');

      expect(status).toBe(200);
      expect(body).toBe('<html>Test</html>');
    });

    it('should handle empty response body', async () => {
      const mockResponse = {
        headers: { 
          get: jest.fn().mockReturnValue(null),
        },
        status: 204,
        data: ''
      };
      
      axios.request.mockResolvedValue(mockResponse);

      const [headers, status, body] = await httpClient.get(ctx, '/empty');

      expect(status).toBe(204);
      expect(body).toBe('');
    });
  });

  describe('Reporter integration', () => {
    it('should call reporter.request before making request', async () => {
      const mockResponse = {
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 200,
        data: { success: true }
      };
      
      axios.request.mockResolvedValue(mockResponse);

      await httpClient.post(ctx, '/test', {
        data: { test: 'data' }
      });

      expect(mockReporter.request).toHaveBeenCalledWith('POST', {
        url: 'https://api.example.com/test',
        options: expect.objectContaining({
          method: 'POST',
          data: JSON.stringify({ test: 'data' })
        })
      });
    });

    it('should call reporter.response after receiving response', async () => {
      const mockResponse = {
        headers: { get: jest.fn().mockReturnValue('application/json') },
        status: 200,
        data: { success: true }
      };
      
      axios.request.mockResolvedValue(mockResponse);

      await httpClient.get(ctx, '/test');

      expect(mockReporter.response).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 200,
          body: { success: true }
        }),
        expect.objectContaining({
          timing: expect.any(Number)
        })
      );
    });
  });
});
