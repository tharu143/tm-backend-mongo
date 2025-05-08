const { Pool } = require('@neondatabase/serverless');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.handler = async function (event, context) {
  const headers = {
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'https://tmcybertech.netlify.app',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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

  // Only allow POST requests for login
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON payload' }),
    };
  }

  const { email, password } = body;
  if (!email || !password) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Email and password are required' }),
    };
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);
    const admin = result.rows[0];

    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid credentials' }),
      };
    }

    const token = jwt.sign({ email: admin.email, id: admin.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    await pool.end();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token }),
    };
  } catch (err) {
    console.error('Login error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};