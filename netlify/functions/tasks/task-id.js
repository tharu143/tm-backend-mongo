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
      const task = await db.collection('tasks')
        .aggregate([
          { $match: { _id: new ObjectId(id) } },
          {
            $lookup: {
              from: 'employees',
              localField: 'employee_id',
              foreignField: '_id',
              as: 'employee',
            },
          },
          { $unwind: '$employee' },
          {
            $project: {
              id: '$_id',
              employee_id: '$employee_id',
              employee_name: '$employee.name',
              title: '$title',
              description: '$description',
              status: '$status',
              due_date: '$due_date',
              created_at: '$created_at',
            },
          },
        ])
        .toArray();

      if (!task[0]) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Task not found' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ...task[0],
          id: task[0].id.toString(),
          employee_id: task[0].employee_id.toString(),
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

      const { employee_id, title, description, status, due_date } = body;
      if (!employee_id || !title || !description || !status || !due_date) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'All fields are required' }),
        };
      }

      const employee = await db.collection('employees').findOne({ _id: new ObjectId(employee_id) });
      if (!employee) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Employee not found' }),
        };
      }

      const updateFields = {
        employee_id: new ObjectId(employee_id),
        title,
        description,
        status,
        due_date: new Date(due_date),
      };

      const result = await db.collection('tasks')
        .findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $set: updateFields },
          { returnDocument: 'after' }
        );

      if (!result.value) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Task not found' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: result.value._id.toString(),
          employee_id: result.value.employee_id.toString(),
          employee_name: employee.name,
          title: result.value.title,
          description: result.value.description,
          status: result.value.status,
          due_date: result.value.due_date,
          created_at: result.value.created_at,
        }),
      };
    } else if (event.httpMethod === 'DELETE') {
      const result = await db.collection('tasks').deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Task not found' }),
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