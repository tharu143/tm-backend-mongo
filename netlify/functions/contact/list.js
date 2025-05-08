const { Pool } = require('@neondatabase/serverless');

exports.handler = async function (event, context) {
  const headers = {
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'https://tmcybertech.netlify.app',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Handle OPTIONS preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC');
    await pool.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.rows),
    };
  } catch (err) {
    console.error('Contact list error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};