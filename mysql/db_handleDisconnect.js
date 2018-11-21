const mysql = require('mysql');
const dbConfig = {
  host: '127.0.0.1',
  user: 'root',
  password: '1q2w3e',
  port: '3306',
  database: 'imagecompression'
};

function handleDisconnect() {
  const connection = mysql.createConnection(dbConfig);
  connection.connect(err => {
    if (err) {
      console.log(`error connecting: ${err.stack}`);
      return setTimeout(handleDisconnect, 2000);
    }
    console.log(`db connnected as id: ${connection.threadId}`);
  });
  connection.on('error', err => {
    console.log(`db error ${err}`);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') handleDisconnect();
    else throw err;
  });
  return connection;
}

module.exports = handleDisconnect;
