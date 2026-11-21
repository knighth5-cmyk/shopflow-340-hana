const mysql = require('mysql2/promise');

exports.handler = async (event, context) => {
    const headers = {
        'Content-Type': 'application/json'
    };

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    
    const queryType = event.queryStringParameters?.query;
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
        
        let query = '';
        
        switch(queryType) {
            case 'top-products':
                query = `
                    SELECT 
                        p.product_name,
                        p.category,
                        COUNT(DISTINCT oi.order_id) as order_count,
                        ROUND(SUM(oi.quantity * oi.unit_price), 2) as revenue
                    FROM products p
                    JOIN order_items oi ON p.product_id = oi.product_id
                    JOIN orders o ON oi.order_id = o.order_id
                    WHERE o.order_status = 'Delivered'
                    GROUP BY p.product_id
                    ORDER BY revenue DESC
                    LIMIT 10
                `;
                break;
                
            case 'segments':
                query = `
                    SELECT 
                        c.customer_segment,
                        COUNT(DISTINCT c.customer_id) as customer_count,
                        COUNT(DISTINCT o.order_id) as total_orders,
                        ROUND(SUM(oi.quantity * oi.unit_price), 2) as actual_revenue
                    FROM customers c
                    LEFT JOIN orders o
                        ON c.customer_id = o.customer_id
                       AND o.order_status = 'Delivered'
                    LEFT JOIN order_items oi ON o.order_id = oi.order_id
                    WHERE c.status = 'Active'
                    GROUP BY c.customer_segment
                    ORDER BY actual_revenue DESC
                `;
                break;
                
            case 'revenue':
                query = `
                    SELECT 
                        p.category,
                        SUM(oi.quantity) as units_sold,
                        ROUND(SUM(oi.quantity * oi.unit_price), 2) as revenue
                    FROM products p
                    JOIN order_items oi ON p.product_id = oi.product_id
                    JOIN orders o ON oi.order_id = o.order_id
                    WHERE o.order_status = 'Delivered'
                    GROUP BY p.category
                    ORDER BY revenue DESC
                `;
                break;
                
            case 'orders':
                query = `
                    SELECT 
                        order_status,
                        COUNT(*) as order_count,
                        ROUND(SUM(total_amount), 2) as total_value
                    FROM orders
                    GROUP BY order_status
                    ORDER BY order_count DESC
                `;
                break;
                
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid query type' })
                };
        }
        
        const [rows] = await connection.execute(query);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(rows)
        };
    } catch (error) {
        console.error('Analytics error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Analytics query failed' })
        };
    } finally {
        if (connection) await connection.end();
    }
};
