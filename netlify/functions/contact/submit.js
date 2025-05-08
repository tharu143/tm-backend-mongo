const { Pool } = require('@neondatabase/serverless');

exports.handler = async function (event, context) {
  // Log the entire event for debugging
  console.log('Full Event:', JSON.stringify(event, null, 2));

  // Log the HTTP method for debugging
  console.log('HTTP Method:', event.httpMethod);

  // Normalize the FRONTEND_URL by removing trailing slashes
  const frontendUrl = (process.env.FRONTEND_URL || 'https://tmcybertech.netlify.app').replace(/\/+$/, '');

  const headers = {
    'Access-Control-Allow-Origin': frontendUrl,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Log the headers for debugging
  console.log('CORS Headers:', headers);

  // Handle OPTIONS preflight request
  if (event.httpMethod.toUpperCase() === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests (case-insensitive)
  if (event.httpMethod.toUpperCase() !== 'POST') {
    console.log('Method not allowed:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
    console.log('Request Body:', body);
  } catch (err) {
    console.log('Invalid JSON payload:', err.message);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON payload' }),
    };
  }

  const { name, email, subject, message } = body;
  if (!name || !email || !subject || !message) {
    console.log('Missing required fields:', { name, email, subject, message });
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'All fields (name, email, subject, message) are required' }),
    };
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await pool.query(
      'INSERT INTO contacts (name, email, subject, message) VALUES ($1, $2, $3, $4)',
      [name, email, subject, message]
    );
    await pool.end();

    console.log('Contact message submitted successfully');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Contact message submitted successfully' }),
    };
  } catch (err) {
    console.error('Contact submission error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};