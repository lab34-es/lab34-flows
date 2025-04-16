const pg = require('pg');

/**
 * Executes a query on a PostgreSQL database.
 *
 * @param {Object} ctx - The context object containing the database connection string.
 * @param {string} ctx.DATABASE_CONNECTION_STRING - The connection string for the PostgreSQL database.
 * @param {string} query - The SQL query to be executed.
 * @param {Array} values - The values to be used in the SQL query.
 * @returns {Promise<Object>} - A promise that resolves to the result of the query.
 * @throws {Error} - Throws an error if the query execution fails.
 */
module.exports.query = (ctx, query, values) => {
  // Get the connection string from the context
  const connectionString = ctx.env.DATABASE_CONNECTION_STRING;

  // Database configuration object
  const dbConfig = {
    connectionString,
  };

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