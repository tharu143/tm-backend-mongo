const { MongoClient, ObjectId } = require('mongodb');
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
      const attendanceRecords = await db.collection('attendance')
        .aggregate([
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
              date: '$date',
              status: '$status',
              created_at: '$created_at',
            },
          },
          { $sort: { created_at: -1 } },
        ])
        .toArray();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(attendanceRecords.map(record => ({
          ...record,
          id: record.id.toString(),
          employee_id: record.employee_id.toString(),
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

      const { employee_id, date, status } = body;
      if (!employee_id || !date || !status) {
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

      const newAttendance = {
        employee_id: new ObjectId(employee_id),
        date: new Date(date),
        status,
        created_at: new Date(),
      };

      const result = await db.collection('attendance').insertOne(newAttendance);
      const insertedAttendance = {
        id: result.insertedId.toString(),
        employee_id: employee_id,
        employee_name: employee.name,
        date: newAttendance.date,
        status: newAttendance.status,
        created_at: newAttendance.created_at,
      };

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(insertedAttendance),
      };
    } else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }
  } catch (err) {
    console.error('Attendance error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  } finally {
    await client.close();
  }
};