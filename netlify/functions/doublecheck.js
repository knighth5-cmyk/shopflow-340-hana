const mysql = require('mysql2/promise');

exports.handler = async () => {
    const names = ['DB_HOST','DB_PORT','DB_USER','DB_PASSWORD','DB_NAME','DB_CA_CERT'];
    const out = { env_present: {}, cert: {}, connection: null };

    names.forEach(n => { out.env_present[n] = Boolean(process.env[n]); });

    const raw = process.env.DB_CA_CERT || '';
    const cert = raw.replace(/\\n/g, '\n');
    out.cert = {
        has_begin: cert.includes('-----BEGIN CERTIFICATE-----'),
        has_end: cert.includes('-----END CERTIFICATE-----'),
        line_count: cert.split('\n').length
    };

    let conn;
    try {
        conn = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: { ca: cert, rejectUnauthorized: true }
        });
        const [rows] = await conn.execute('SELECT COUNT(*) AS n FROM products');
        out.connection = { ok: true, products: rows[0].n };
    } catch (e) {
        out.connection = { ok: false, code: e.code || null, errno: e.errno || null };
    } finally {
        if (conn) await conn.end();
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) };
};
