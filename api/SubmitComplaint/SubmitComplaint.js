// api/submitComplaint/SubmitComplaint.js
module.exports = async function (context, req) {
  try {
    context.log('Function triggered for /api/submitComplaint');

    // --- request diagnostics ---
    const ct = ((req.headers && (req.headers['content-type'] || req.headers['Content-Type'])) || '').toLowerCase();
    context.log('Content-Type:', ct, '| typeof req.body:', typeof req.body);

    // --- parse body (JSON or x-www-form-urlencoded) ---
    let body = req.body || {};
    if (typeof body === 'string') {
      if (ct.includes('application/json')) {
        try { body = JSON.parse(body || '{}'); } catch {}
      } else if (ct.includes('application/x-www-form-urlencoded')) {
        const qs = require('querystring');
        body = qs.parse(body);
      }
    }

    // accept either JSON keys or native form field names
    const name = (body.name ?? body['applicant-name'] ?? '').toString().trim();
    const complaintDetails = (body.complaintDetails ?? body['complaint-details'] ?? '').toString().trim();
    context.log('Body keys:', Object.keys(body));

    if (!name || !complaintDetails) {
      context.res = {
        status: 400,
        body: `Please provide both name and complaint details. Keys seen: ${Object.keys(body).join(', ')}`
      };
      return;
    }

    // --- env var ---
    const connectionString = process.env.CUSTOM_SERVICE_BUS_CONNECTION;
    if (!connectionString) {
      context.res = { status: 500, body: 'Service Bus connection string is not configured.' };
      return;
    }

    // -
