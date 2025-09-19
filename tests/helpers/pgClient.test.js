const pg = require('pg');
const pgClient = require('../../src/helpers/pgClient');

// Mock the pg module
jest.mock('pg');

describe('pgClient', () => {
  let mockClient;
  let ctx;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create a mock client
    mockClient = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn()
    };

    // Mock the Client constructor
    pg.Client = jest.fn(() => mockClient);

    // Create test context
    ctx = {
      env: {}
    };
  });

  describe('Connection configuration', () => {
    it('should use connection string when DATABASE_CONNECTION_STRING is provided', async () => {
      ctx.env.DATABASE_CONNECTION_STRING = 'postgresql://user:pass@localhost:5432/testdb';
      
      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue({
        rows: [{ id: 1 }],
        rowCount: 1
      });

      await pgClient.query(ctx, 'SELECT * FROM users', []);

      expect(pg.Client).toHaveBeenCalledWith({
        connectionString: 'postgresql://user:pass@localhost:5432/testdb'
      });
    });

    it('should use individual parameters when provided', async () => {
      ctx.env = {
        PGUSER: 'testuser',
        PGPASSWORD: 'testpass',
        PGHOST: 'localhost',
        PGPORT: '5432',
        PGDATABASE: 'testdb'
      };

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      await pgClient.query(ctx, 'SELECT 1', []);

      expect(pg.Client).toHaveBeenCalledWith({
        user: 'testuser',
        password: 'testpass',
        host: 'localhost',
        port: 5432,
        database: 'testdb'
      });
    });

    it('should handle partial individual parameters', async () => {
      ctx.env = {
        PGUSER: 'testuser',
        PGHOST: 'localhost',
        PGDATABASE: 'testdb'
      };

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      await pgClient.query(ctx, 'SELECT 1', []);

      expect(pg.Client).toHaveBeenCalledWith({
        user: 'testuser',
        host: 'localhost',
        database: 'testdb'
      });
    });

    it('should prioritize connection string over individual parameters', async () => {
      ctx.env = {
        DATABASE_CONNECTION_STRING: 'postgresql://priority:pass@priority.com:5432/prioritydb',
        PGUSER: 'ignored',
        PGHOST: 'ignored',
        PGDATABASE: 'ignored'
      };

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      await pgClient.query(ctx, 'SELECT 1', []);

      expect(pg.Client).toHaveBeenCalledWith({
        connectionString: 'postgresql://priority:pass@priority.com:5432/prioritydb'
      });
    });

    it('should include additional configuration parameters', async () => {
      ctx.env = {
        PGUSER: 'testuser',
        PGHOST: 'localhost',
        PGDATABASE: 'testdb',
        PGQUERY_TIMEOUT: '30000',
        PGLOCK_TIMEOUT: '10000',
        PGCLIENT_ENCODING: 'UTF8',
        PGOPTIONS: '-c statement_timeout=60s'
      };

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      await pgClient.query(ctx, 'SELECT 1', []);

      expect(pg.Client).toHaveBeenCalledWith({
        user: 'testuser',
        host: 'localhost',
        database: 'testdb',
        query_timeout: 30000,
        lock_timeout: 10000,
        client_encoding: 'UTF8',
        options: '-c statement_timeout=60s'
      });
    });

    it('should work with connection string and additional parameters', async () => {
      ctx.env = {
        DATABASE_CONNECTION_STRING: 'postgresql://user:pass@localhost:5432/testdb',
        PGQUERY_TIMEOUT: '30000',
        PGLOCK_TIMEOUT: '10000'
      };

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      await pgClient.query(ctx, 'SELECT 1', []);

      expect(pg.Client).toHaveBeenCalledWith({
        connectionString: 'postgresql://user:pass@localhost:5432/testdb',
        query_timeout: 30000,
        lock_timeout: 10000
      });
    });
  });

  describe('Query execution', () => {
    beforeEach(() => {
      ctx.env.DATABASE_CONNECTION_STRING = 'postgresql://user:pass@localhost:5432/testdb';
    });

    it('should execute a simple query successfully', async () => {
      const expectedResult = {
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1,
        command: 'SELECT'
      };

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue(expectedResult);

      const result = await pgClient.query(ctx, 'SELECT * FROM users WHERE id = 1', []);

      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = 1', []);
      expect(mockClient.end).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    it('should execute a query with parameters', async () => {
      const expectedResult = {
        rows: [{ id: 1, name: 'John' }],
        rowCount: 1
      };

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue(expectedResult);

      const result = await pgClient.query(
        ctx,
        'SELECT * FROM users WHERE id = $1 AND name = $2',
        [1, 'John']
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1 AND name = $2',
        [1, 'John']
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle INSERT queries', async () => {
      const expectedResult = {
        rows: [{ id: 5 }],
        rowCount: 1,
        command: 'INSERT'
      };

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue(expectedResult);

      const result = await pgClient.query(
        ctx,
        'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id',
        ['Alice', 'alice@example.com']
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id',
        ['Alice', 'alice@example.com']
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle UPDATE queries', async () => {
      const expectedResult = {
        rows: [],
        rowCount: 3,
        command: 'UPDATE'
      };

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue(expectedResult);

      const result = await pgClient.query(
        ctx,
        'UPDATE users SET status = $1 WHERE created_at < $2',
        ['inactive', '2023-01-01']
      );

      expect(result.rowCount).toBe(3);
    });

    it('should handle DELETE queries', async () => {
      const expectedResult = {
        rows: [],
        rowCount: 2,
        command: 'DELETE'
      };

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue(expectedResult);

      const result = await pgClient.query(
        ctx,
        'DELETE FROM users WHERE id = $1',
        [10]
      );

      expect(result.rowCount).toBe(2);
    });

    it('should handle queries with no results', async () => {
      const expectedResult = {
        rows: [],
        rowCount: 0
      };

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue(expectedResult);

      const result = await pgClient.query(
        ctx,
        'SELECT * FROM users WHERE id = $1',
        [999]
      );

      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should handle queries with null values', async () => {
      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue({
        rows: [{ id: 1, name: null }],
        rowCount: 1
      });

      await pgClient.query(
        ctx,
        'INSERT INTO users (name, email) VALUES ($1, $2)',
        [null, 'test@example.com']
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO users (name, email) VALUES ($1, $2)',
        [null, 'test@example.com']
      );
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      ctx.env.DATABASE_CONNECTION_STRING = 'postgresql://user:pass@localhost:5432/testdb';
    });

    it('should handle connection errors', async () => {
      const connectionError = new Error('Connection refused');
      mockClient.connect.mockRejectedValue(connectionError);

      await expect(
        pgClient.query(ctx, 'SELECT 1', [])
      ).rejects.toThrow('Connection refused');

      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.query).not.toHaveBeenCalled();
      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should handle query execution errors', async () => {
      const queryError = new Error('relation "nonexistent" does not exist');
      mockClient.connect.mockResolvedValue();
      mockClient.query.mockRejectedValue(queryError);

      await expect(
        pgClient.query(ctx, 'SELECT * FROM nonexistent', [])
      ).rejects.toThrow('relation "nonexistent" does not exist');

      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalled();
      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should handle syntax errors in queries', async () => {
      const syntaxError = new Error('syntax error at or near "SELCT"');
      mockClient.connect.mockResolvedValue();
      mockClient.query.mockRejectedValue(syntaxError);

      await expect(
        pgClient.query(ctx, 'SELCT * FROM users', [])
      ).rejects.toThrow('syntax error at or near "SELCT"');

      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should handle permission errors', async () => {
      const permissionError = new Error('permission denied for table users');
      mockClient.connect.mockResolvedValue();
      mockClient.query.mockRejectedValue(permissionError);

      await expect(
        pgClient.query(ctx, 'DELETE FROM users', [])
      ).rejects.toThrow('permission denied for table users');

      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should close connection even when query fails', async () => {
      mockClient.connect.mockResolvedValue();
      mockClient.query.mockRejectedValue(new Error('Query failed'));

      try {
        await pgClient.query(ctx, 'SELECT * FROM users', []);
      } catch (error) {
        // Expected to throw
      }

      expect(mockClient.end).toHaveBeenCalled();
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Query timeout');
      timeoutError.code = 'QUERY_TIMEOUT';
      
      mockClient.connect.mockResolvedValue();
      mockClient.query.mockRejectedValue(timeoutError);

      await expect(
        pgClient.query(ctx, 'SELECT pg_sleep(100)', [])
      ).rejects.toThrow('Query timeout');

      expect(mockClient.end).toHaveBeenCalled();
    });
  });

  describe('Connection lifecycle', () => {
    beforeEach(() => {
      ctx.env.DATABASE_CONNECTION_STRING = 'postgresql://user:pass@localhost:5432/testdb';
    });

    it('should properly manage connection lifecycle for successful query', async () => {
      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue({
        rows: [{ count: 10 }],
        rowCount: 1
      });

      await pgClient.query(ctx, 'SELECT COUNT(*) FROM users', []);

      // Verify the order of operations
      const connectOrder = mockClient.connect.mock.invocationCallOrder[0];
      const queryOrder = mockClient.query.mock.invocationCallOrder[0];
      const endOrder = mockClient.end.mock.invocationCallOrder[0];

      expect(connectOrder).toBeLessThan(queryOrder);
      expect(queryOrder).toBeLessThan(endOrder);
    });

    it('should create a new client for each query', async () => {
      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      // Execute two queries
      await pgClient.query(ctx, 'SELECT 1', []);
      await pgClient.query(ctx, 'SELECT 2', []);

      // Verify that Client constructor was called twice
      expect(pg.Client).toHaveBeenCalledTimes(2);
      expect(mockClient.connect).toHaveBeenCalledTimes(2);
      expect(mockClient.end).toHaveBeenCalledTimes(2);
    });

    it('should not reuse connections between queries', async () => {
      const client1 = {
        connect: jest.fn().mockResolvedValue(),
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        end: jest.fn()
      };

      const client2 = {
        connect: jest.fn().mockResolvedValue(),
        query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        end: jest.fn()
      };

      // Mock Client to return different instances
      pg.Client
        .mockImplementationOnce(() => client1)
        .mockImplementationOnce(() => client2);

      await pgClient.query(ctx, 'SELECT 1', []);
      await pgClient.query(ctx, 'SELECT 2', []);

      expect(client1.connect).toHaveBeenCalledTimes(1);
      expect(client1.end).toHaveBeenCalledTimes(1);
      expect(client2.connect).toHaveBeenCalledTimes(1);
      expect(client2.end).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty environment configuration', async () => {
      ctx.env = {};

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      await pgClient.query(ctx, 'SELECT 1', []);

      expect(pg.Client).toHaveBeenCalledWith({});
    });

    it('should handle undefined values array', async () => {
      ctx.env.DATABASE_CONNECTION_STRING = 'postgresql://user:pass@localhost:5432/testdb';

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      await pgClient.query(ctx, 'SELECT * FROM users', undefined);

      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users', undefined);
    });

    it('should handle empty values array', async () => {
      ctx.env.DATABASE_CONNECTION_STRING = 'postgresql://user:pass@localhost:5432/testdb';

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      await pgClient.query(ctx, 'SELECT * FROM users', []);

      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM users', []);
    });

    it('should parse PGPORT as integer', async () => {
      ctx.env = {
        PGHOST: 'localhost',
        PGPORT: '5433', // String that should be parsed to integer
        PGDATABASE: 'testdb'
      };

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      await pgClient.query(ctx, 'SELECT 1', []);

      expect(pg.Client).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5433, // Should be an integer
        database: 'testdb'
      });
    });

    it('should parse timeout values as integers', async () => {
      ctx.env = {
        PGHOST: 'localhost',
        PGDATABASE: 'testdb',
        PGQUERY_TIMEOUT: '30000',
        PGLOCK_TIMEOUT: '10000'
      };

      mockClient.connect.mockResolvedValue();
      mockClient.query.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      await pgClient.query(ctx, 'SELECT 1', []);

      expect(pg.Client).toHaveBeenCalledWith({
        host: 'localhost',
        database: 'testdb',
        query_timeout: 30000,
        lock_timeout: 10000
      });
    });
  });
});
