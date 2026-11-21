const mysql = require('mysql2/promise');

exports.handler = async (event, context) => {
    const headers = {
        'Content-Type': 'application/json'
    };

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    
    const email = event.queryStringParameters?.email;
    
    if (!email) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Email required' })
        };
    }
    
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: {
                ca: process.env.DB_CA_CERT.replace(/\\n/g, '\n'),
                rejectUnauthorized: true
            }
        });
        
        const [rows] = await connection.execute(
            `SELECT customer_id, first_name, last_name, email,
                    customer_segment, lifetime_value, status, registration_date
             FROM customers
             WHERE email = ?`,
            [email.toLowerCase()]
        );
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(rows[0] || null)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Lookup failed' })
        };
    } finally {
        if (connection) await connection.end();
    }
};
