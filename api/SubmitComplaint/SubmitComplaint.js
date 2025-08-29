// api/submitComplaint/SubmitComplaint.js
module.exports = async function (context, req) {
  try {
    context.log('Function triggered for /api/submitComplaint');

    // --- Parse body (JSON or x-www-form-urlencoded) ---
    const ct = ((req.headers && (req.headers['content-type'] || req.headers['Content-Type'])) || '').toLowerCase();
    let body = req.body || {};
    if (typeof body === 'string') {
      if (ct.includes('application/json')) {
        try { body = JSON.parse(body || '{}'); } catch {}
      } else if (ct.includes('application/x-www-form-urlencoded')) {
        const qs = require('querystring');
        body = qs.parse(body);
      }
    }

    // Accept either JSON keys or native form field names
    const name = (body.name ?? body['applicant-name'] ?? '').toString().trim();
    const complaintDetails = (body.complaintDetails ?? body['complaint-details'] ?? '').toString().trim();

    if (!name || !complaintDetails) {
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'text/plain' },
        body: `Please provide both name and complaint details. Keys seen: ${Object.keys(body || {}).join(', ')}`
      };
      return;
    }

    // --- Env var check ---
    const connectionString = process.env.CUSTOM_SERVICE_BUS_CONNECTION;
    if (!connectionString) {
      context.res = { status: 500, headers: { 'Content-Type': 'text/plain' }, body: 'Service Bus connection string is not configured.' };
      return;
    }

    // --- TEMP: echo to prove end-to-end wiring (uncomment to test) ---
    // context.res = {
    //   status: 200,
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ ok: true, echo: { name, complaintDetails } })
    // };
    // return;

    // --- Service Bus send (fully wrapped) ---
    const queueName = process.env.SB_QUEUE || 'complaintsqueue';
    let sbClient, sender;

    try {
      const { ServiceBusClient } = require('@azure/service-bus'); // inside try
      sbClient = new ServiceBusClient(connectionString);
      sender = sbClient.createSender(queueName);

      await sender.sendMessages({
        body: { name, complaintDetails, timestamp: new Date().toISOString() }
      });

      context.res = { status: 200, headers: { 'Content-Type': 'text/plain' }, body: 'Complaint submitted successfully!' };
    } catch (error) {
      const msg =
        (error && (error.code || error.name)) ? `${error.code || error.name}: ${error.message}` :
        (error && error.message) ? error.message :
        'Unknown error';
      if (error && (error.code === 'MODULE_NOT_FOUND' || /Cannot find module/i.test(error.message))) {
        context.res = { status: 500, headers: { 'Content-Type': 'text/plain' }, body: 'Missing dependency @azure/service-bus. Add it to api/package.json and redeploy.' };
      } else {
        context.res = { status: 500, headers: { 'Content-Type': 'text/plain' }, body: `Failed to send to Service Bus: ${msg}` };
      }
    } finally {
      try { if (sender) await sender.close(); } catch {}
      try { if (sbClient) await sbClient.close(); } catch {}
    }
  } catch (outer) {
    // absolute last resort so you never get an empty 500
    context.log.error('UNHANDLED ERROR', outer);
    context.res = { status: 500, headers: { 'Content-Type': 'text/plain' }, body: `Unhandled error: ${outer.name}: ${outer.message}` };
  }
};
