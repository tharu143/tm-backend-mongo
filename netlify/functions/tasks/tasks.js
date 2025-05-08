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
      const tasks = await db.collection('tasks')
        .find({})
        .sort({ created_at: -1 })
        .toArray();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(tasks.map(task => ({
          id: task._id.toString(),
          title: task.title,
          description: task.description,
          status: task.status,
          due_date: task.due_date,
          created_at: task.created_at,
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

      const { title, description, status, due_date } = body;
      if (!title || !status || !due_date) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Title, status, and due date are required' }),
        };
      }

      const newTask = {
        title,
        description: description || '',
        status,
        due_date: new Date(due_date),
        created_at: new Date(),
      };

      const result = await db.collection('tasks').insertOne(newTask);
      const insertedTask = {
        id: result.insertedId.toString(),
        ...newTask,
      };

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(insertedTask),
      };
    } else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }
  } catch (err) {
    console.error('Tasks error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  } finally {
    await client.close();
  }
};