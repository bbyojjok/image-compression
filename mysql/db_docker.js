const mysql = require('mysql');
const pool = mysql.createPool({
  connectionLimit: 50,
  host: '10.5.0.5',
  user: 'root',
  password: '1q2w3e',
  port: '3306',
  database: 'imagecompression'
});

pool.on('connection', connection => {
  console.log(`# pool connection ${connection.threadId}`);
});

module.exports = pool;
