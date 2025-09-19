const pg = require('pg');

/**
 * Executes a query on a PostgreSQL database.
 *
 * @param {Object} ctx - The context object containing the database configuration.
 * @param {Object} ctx.env - Environment variables for database configuration.
 * @param {string} [ctx.env.DATABASE_CONNECTION_STRING] - The connection string for the PostgreSQL database.
 * @param {string} [ctx.env.PGUSER] - Database user.
 * @param {string} [ctx.env.PGPASSWORD] - Database password.
 * @param {string} [ctx.env.PGHOST] - Database host.
 * @param {string} [ctx.env.PGPORT] - Database port.
 * @param {string} [ctx.env.PGDATABASE] - Database name.
 * @param {string} [ctx.env.PGQUERY_TIMEOUT] - Query timeout in milliseconds.
 * @param {string} [ctx.env.PGLOCK_TIMEOUT] - Lock timeout in milliseconds.
 * @param {string} [ctx.env.PGCLIENT_ENCODING] - Client encoding.
 * @param {string} [ctx.env.PGOPTIONS] - Command-line options to be sent to the server.
 * @param {string} query - The SQL query to be executed.
 * @param {Array} values - The values to be used in the SQL query.
 * @returns {Promise<Object>} - A promise that resolves to the result of the query.
 * @throws {Error} - Throws an error if the query execution fails.
 */
module.exports.query = (ctx, query, values) => {
  // Build database configuration object
  const dbConfig = {};

  // Priority 1: Use connection string if provided (for backward compatibility)
  if (ctx.env.DATABASE_CONNECTION_STRING) {
    dbConfig.connectionString = ctx.env.DATABASE_CONNECTION_STRING;
  } else {
    // Priority 2: Use individual parameters
    if (ctx.env.PGUSER) {
      dbConfig.user = ctx.env.PGUSER;
    }
    
    if (ctx.env.PGPASSWORD) {
      dbConfig.password = ctx.env.PGPASSWORD;
    }
    
    if (ctx.env.PGHOST) {
      dbConfig.host = ctx.env.PGHOST;
    }
    
    if (ctx.env.PGPORT) {
      dbConfig.port = parseInt(ctx.env.PGPORT, 10);
    }
    
    if (ctx.env.PGDATABASE) {
      dbConfig.database = ctx.env.PGDATABASE;
    }
  }

  // Additional configuration parameters (work with both connection string and individual params)
  if (ctx.env.PGQUERY_TIMEOUT) {
    dbConfig.query_timeout = parseInt(ctx.env.PGQUERY_TIMEOUT, 10);
  }
  
  if (ctx.env.PGLOCK_TIMEOUT) {
    dbConfig.lock_timeout = parseInt(ctx.env.PGLOCK_TIMEOUT, 10);
  }
  
  if (ctx.env.PGCLIENT_ENCODING) {
    dbConfig.client_encoding = ctx.env.PGCLIENT_ENCODING;
  }
  
  if (ctx.env.PGOPTIONS) {
    dbConfig.options = ctx.env.PGOPTIONS;
  }

  // Create a new PostgreSQL client
  const client = new pg.Client(dbConfig);

  // Connect to the database
  return client.connect()
    .then(() => {
      // Execute the query with the provided values
      return client.query(query, values)
    })
    .then((res) => {
      // Close the database connection
      client.end();
      // Return the query result
      return res;
    })
    .catch((err) => {
      // Close the database connection in case of an error
      client.end();
      // Throw the error to be handled by the caller
      throw err;
    });
}
