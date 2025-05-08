const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.handler = async function (event, context) {
  const headers = {
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'https://tmcybertech.netlify.app',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
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

  const { id } = event.queryStringParameters || {};

  if (!id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'ID is required' }),
    };
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();

    if (event.httpMethod === 'GET') {
      const admin = await db.collection('admins')
        .findOne({ _id: new ObjectId(id) }, { projection: { password_hash: 0 } });
      if (!admin) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Admin not found' }),
        };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: admin._id.toString(),
          email: admin.email,
          created_at: admin.created_at,
        }),
      };
    } else if (event.httpMethod === 'PUT') {
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
      if (!email) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email is required' }),
        };
      }

      const updateFields = { email };
      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        updateFields.password_hash = passwordHash;
      }

      const result = await db.collection('admins')
        .findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $set: updateFields },
          { returnDocument: 'after', projection: { password_hash: 0 } }
        );

      if (!result.value) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Admin not found' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: result.value._id.toString(),
          email: result.value.email,
          created_at: result.value.created_at,
        }),
      };
    } else if (event.httpMethod === 'DELETE') {
      const result = await db.collection('admins').deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Admin not found' }),
        };
      }
      return {
        statusCode: 204,
        headers,
        body: '',
      };
    } else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }
  } catch (err) {
    console.error('Admins error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  } finally {
    await client.close();
  }
};