const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

exports.handler = async function (event, context) {
  const headers = {
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'https://tmcybertech.netlify.app',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Invalid token' }),
    };
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();

    if (event.httpMethod === 'GET') {
      const certificates = await db.collection('certificates')
        .find({})
        .sort({ created_at: -1 })
        .toArray();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(certificates.map(certificate => ({
          id: certificate._id.toString(),
          name: certificate.name,
          start_date: certificate.start_date,
          end_date: certificate.end_date,
          type: certificate.type,
          created_at: certificate.created_at,
        }))),
      };
    } else if (event.httpMethod === 'POST') {
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

      const { name, start_date, end_date, type } = body;
      if (!name || !start_date || !end_date || !type) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'All fields are required' }),
        };
      }

      const newCertificate = {
        name,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        type,
        created_at: new Date(),
      };

      const result = await db.collection('certificates').insertOne(newCertificate);
      const insertedCertificate = {
        id: result.insertedId.toString(),
        ...newCertificate,
      };

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(insertedCertificate),
      };
    } else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }
  } catch (err) {
    console.error('Certificates error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  } finally {
    await client.close();
  }
};