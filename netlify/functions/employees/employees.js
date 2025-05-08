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
      const employees = await db.collection('employees')
        .find({})
        .sort({ created_at: -1 })
        .toArray();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(employees.map(employee => ({
          id: employee._id.toString(),
          name: employee.name,
          email: employee.email,
          position: employee.position,
          joining_date: employee.joining_date,
          salary: employee.salary,
          created_at: employee.created_at,
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

      const { name, email, position, joining_date, salary } = body;
      if (!name || !email || !position || !joining_date || !salary) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'All fields are required' }),
        };
      }

      const newEmployee = {
        name,
        email,
        position,
        joining_date: new Date(joining_date),
        salary: parseFloat(salary),
        created_at: new Date(),
      };

      const result = await db.collection('employees').insertOne(newEmployee);
      const insertedEmployee = {
        id: result.insertedId.toString(),
        ...newEmployee,
      };

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(insertedEmployee),
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