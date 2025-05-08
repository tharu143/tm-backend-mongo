const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

exports.handler = async function (event, context) {
  const headers = {
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'https://tmcybertech.netlify.app',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
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

  const { operation, collection, query, update } = body;
  if (!operation || !collection) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Operation and collection are required' }),
    };
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    let result;

    if (operation === 'find') {
      if (!query) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Query is required for find operation' }),
        };
      }
      if (query._id) {
        query._id = new ObjectId(query._id);
      }
      result = await db.collection(collection).find(query).toArray();
    } else if (operation === 'update') {
      if (!query || !update) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Query and update are required for update operation' }),
        };
      }
      if (query._id) {
        query._id = new ObjectId(query._id);
      }
      result = await db.collection(collection).updateMany(query, { $set: update });
      result = { modifiedCount: result.modifiedCount };
    } else if (operation === 'delete') {
      if (!query) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Query is required for delete operation' }),
        };
      }
      if (query._id) {
        query._id = new ObjectId(query._id);
      }
      result = await db.collection(collection).deleteMany(query);
      result = { deletedCount: result.deletedCount };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid operation' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error('Database error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to execute query' }),
    };
  } finally {
    await client.close();
  }
};