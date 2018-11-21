const getUseragent = req => {
  let ua = req.headers['user-agent'].toLocaleLowerCase();
  if (ua.indexOf('chrome') > 0) ua = 'chrome browser';
  else if (ua.indexOf('firefox') > 0) ua = 'firefox browser';
  else if (ua.indexOf('trident') > 0) ua = 'ie browser';
  else ua = 'etc browser';
  return ua;
};

const getIpAddress = req => {
  let ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(':').pop();
  return ip;
};

const formatBytes = (bytes, decimals) => {
  if (bytes == 0) return '0 Bytes';
  let k = 1024;
  let dm = decimals || 2;
  let sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

module.exports = { getUseragent, getIpAddress, formatBytes };
