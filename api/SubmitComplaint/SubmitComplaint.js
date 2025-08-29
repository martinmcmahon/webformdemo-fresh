// PROBE 5: test HTTPS egress to your Service Bus namespace
module.exports = async function (context, req) {
  const { parseServiceBusConnectionString } = require('@azure/service-bus');
  const https = require('https');

  const conn = process.env.CUSTOM_SERVICE_BUS_CONNECTION || '';
  const { endpoint } = parseServiceBusConnectionString(conn); // e.g. "sb://<ns>.servicebus.windows.net/"
  const url = (endpoint || '').replace(/^sb:/, 'https:') + '$hc'; // public health endpoint

  const result = await new Promise((resolve) => {
    const req = https.request(url, { method: 'GET', timeout: 3000 }, (res) => {
      resolve(`egress-ok status=${res.statusCode}`); // 401/403 is fine: it proves we can reach it
    });
    req.on('timeout', () => { req.destroy(new Error('TIMEOUT')); });
    req.on('error', (err) => resolve(`egress-failed ${err.code || err.name}: ${err.message}`));
    req.end();
  });

  context.res = { status: 200, headers: { 'Content-Type': 'text/plain' }, body: result + `\nurl=${url}` };
};
