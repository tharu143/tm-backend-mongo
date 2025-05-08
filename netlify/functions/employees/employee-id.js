const { MongoClient, ObjectId } = require('mongodb');
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
      const employee = await db.collection('employees').findOne({ _id: new ObjectId(id) });
      if (!employee) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Employee not found' }),
        };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: employee._id.toString(),
          name: employee.name,
          email: employee.email,
          position: employee.position,
          joining_date: employee.joining_date,
          salary: employee.salary,
          created_at: employee.created_at,
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

      const { name, email, position, joining_date, salary } = body;
      if (!name || !email || !position || !joining_date || !salary) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'All fields are required' }),
        };
      }

      const updateFields = {
        name,
        email,
        position,
        joining_date: new Date(joining_date),
        salary: parseFloat(salary),
      };

      const result = await db.collection('employees')
        .findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $set: updateFields },
          { returnDocument: 'after' }
        );

      if (!result.value) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Employee not found' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: result.value._id.toString(),
          name: result.value.name,
          email: result.value.email,
          position: result.value.position,
          joining_date: result.value.joining_date,
          salary: result.value.salary,
          created_at: result.value.created_at,
        }),
      };
    } else if (event.httpMethod === 'DELETE') {
      const result = await db.collection('employees').deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Employee not found' }),
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
    console.error('Employees error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  } finally {
    await client.close();
  }
};