module.exports = async function (context, req) {
  const progress = [];
  const reply = (status, body) => {
    context.res = {
      status,
      headers: { 'Content-Type': 'text/plain' },
      body: `${body}\n\nprogress: ${progress.join(' > ')}`
    };
  };

  try {
    progress.push('start');

    // --- Parse body (JSON or form) ---
    const ct = ((req.headers && (req.headers['content-type'] || req.headers['Content-Type'])) || '').toLowerCase();
    let body = req.body || {};
    if (typeof body === 'string') {
      if (ct.includes('application/json')) {
        try { body = JSON.parse(body || '{}'); } catch {}
      } else if (ct.includes('application/x-www-form-urlencoded')) {
        body = require('querystring').parse(body);
      }
    }
    progress.push('parsed');

    const name = (body.name ?? body['applicant-name'] ?? '').toString().trim();
    const complaintDetails = (body.complaintDetails ?? body['complaint-details'] ?? '').toString().trim();
    if (!name || !complaintDetails) {
      return reply(400, `Missing fields. Keys: ${Object.keys(body).join(', ')}`);
    }
    progress.p
