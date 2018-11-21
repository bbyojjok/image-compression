const mysql = require('mysql');
const pool = mysql.createPool({
  connectionLimit: 50,
  host: '127.0.0.1',
  user: 'root',
  password: '1q2w3e',
  port: '3306',
  database: 'imagecompression'
});

pool.on('connection', connection => {
  console.log(`# pool connection ${connection.threadId}`);
});

module.exports = pool;
