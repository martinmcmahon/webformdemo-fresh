// Send to Azure Service Bus via REST (HTTPS) to avoid AMQP/WSS issues
const crypto = require('crypto');
const qs = require('querystring');

function parseConn(cs) {
  // cs: "Endpoint=sb://<ns>.servicebus.windows.net/;SharedAccessKeyName=...;SharedAccessKey=..."
  const parts = Object.fromEntries(cs.split(';').filter(Boolean).map(kv => {
    const [k, v] = kv.split('=');
    return [k, v];
  }));
  const endpoint = (parts.Endpoint || '').replace(/^sb:/, 'https:').replace(/\/+$/, '/'); // https://<ns>.servicebus.windows.net/
  const namespaceHost = endpoint.replace(/^https:\/\/|\/$/g, ''); // <ns>.servicebus.windows.net
  return {
    endpoint,                     // https://<ns>.servicebus.windows.net/
    host: namespaceHost,          // <ns>.servicebus.windows.net
    keyName: parts.SharedAccessKeyName,
    key: parts.SharedAccessKey
  };
}

function buildSas({ resourceUri, keyName, key, ttlSeconds = 300 }) {
  const se = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sr = encodeURIComponent(resourceUri.toLowerCase());
  const toSign = `${sr}\n${se}`;
  const sig = crypto.createHmac('sha256', key).update(toSign, 'utf8').digest('base64');
  const token = `SharedAccessSignature sr=${sr}&sig=${encodeURIComponent(sig)}&se=${se}&skn=${encodeURIComponent(keyName)}`;
  return token;
}

module.exports = async function (context, req) {
  try {
    // ---- Parse body (supports JSON or x-www-form-urlencoded) ----
    const ct = ((req?.headers?.['content-type'] || req?.headers?.['Content-Type']) || '').toLowerCase();
    let body = req?.body || {};
    if (typeof body === 'string') {
      if (ct.includes('application/json')) { try { body = JSON.parse(body || '{}'); } catch {} }
      else if (ct.includes('application/x-www-form-urlencoded')) { body = qs.parse(body); }
    }
    const name = (body.name ?? body['applicant-name'] ?? '').toString().trim();
    const complaintDetails = (body.complaintDetails ?? body['complaint-details'] ?? '').toString().trim();
    if (!name || !complaintDetails) {
      context.res = { status: 400, headers: { 'Content-Type': 'text/plain' },
        body: `Please provide both name and complaint details. Keys: ${Object.keys(body).join(', ')}` };
      return;
    }

    const connStr = process.env.CUSTOM_SERVICE_BUS_CONNECTION;
    if (!connStr) {
      context.res = { status: 500, headers: { 'Content-Type': 'text/plain' },
        body: 'Service Bus connection string is not configured.' };
      return;
    }

    const { endpoint, keyName, key } = parseConn(connStr);
    const queueName = process.env.SB_QUEUE || 'complaintsqueue'; // or set SB_QUEUE in SWA env vars
    const resourceUri = `${endpoint}${queueName}`.replace(/\/+$/, '');  // https://<ns>.servicebus.windows.net/<queue>
    const sas = buildSas({ resourceUri, keyName, key, ttlSeconds: 300 });

    // ---- Send via REST: POST https://<ns>.servicebus.windows.net/<queue>/messages ----
    const payload = JSON.stringify({ name, complaintDetails, timestamp: new Date().toISOString() });

    // Native https to avoid extra deps
    const https = require('https');
    const url = new URL(`${resourceUri}/messages`);
    const options = {
      method: 'POST',
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'Authorization': sas,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    };

    const result = await new Promise((resolve) => {
      const r = https.request(options, (res) => {
        let data = '';
        res.on('data', (d) => (data += d.toString('utf8')));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      r.on('error', (err) => resolve({ status: 0, body: `Network error: ${err.code || err.name}: ${err.message}` }));
      r.on('timeout', () => { r.destroy(new Error('TIMEOUT')); });
      r.write(payload);
      r.end();
    });

    if (result.status === 201) {
      context.res = { status: 200, headers: { 'Content-Type': 'text/plain' }, body: 'Complaint submitted successfully!' };
    } else {
      // Surface exact reason (401 Unauthorized, 404 Not Found, 403 Forbidden, etc.)
      context.res = { status: 500, headers: { 'Content-Type': 'text/plain' },
        body: `REST send failed: ${result.status} ${result.body || ''}` };
    }
  } catch (outer) {
    context.res = { status: 500, headers: { 'Content-Type': 'text/plain' },
      body: `Unhandled: ${outer.name}: ${outer.message}` };
  }
};
