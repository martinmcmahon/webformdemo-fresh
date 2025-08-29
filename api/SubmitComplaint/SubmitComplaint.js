// api/submitComplaint/SubmitComplaint.js
module.exports = async function (context, req) {
  context.log('Function triggered for /api/submitComplaint');

  // --- request diagnostics ---
  const ct = ((req.headers && (req.headers['content-type'] || req.headers['Content-Type'])) || '').toLowerCase();
  context.log('Content-Type:', ct, '| typeof req.body:', typeof req.body);
  context.log('Body keys:', req && req.body && typeof req.body === 'object' ? Object.keys(req.body) : 'n/a');

  // --- env var ---
  const connectionString = process.env.CUSTOM_SERVICE_BUS_CONNECTION;
  context.log('HAS_CUSTOM_SERVICE_BUS_CONNECTION', !!connectionString);
  if (!connectionString) {
    context.res = { status: 500, body: 'Service Bus connection string is not configured.' };
    return;
  }

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

  context.log('CT:', ct, '| keys:', Object.keys(body));
  if (!name || !complaintDetails) {
    context.res = {
      status: 400,
      body: `Please provide both name and complaint details. Keys seen: ${Object.keys(body).join(', ')}`
    };
    return;
  }

  context.log(`Processing submission for name: ${name}, details: ${complaintDetails}`);

  // --- Service Bus send (fully wrapped so errors are surfaced) ---
  const queueName = process.env.SB_QUEUE || 'complaintsqueue';
  let sbClient, sender;

  try {
    // require inside try so missing module is caught cleanly
    const { ServiceBusClient } = require('@azure/service-bus');

    sbClient = new ServiceBusClient(connectionString);
    sender = sbClient.createSender(queueName);

    const message = { body: { name, complaintDetails, timestamp: new Date().toISOString() } };
    context.log('Sending message to Service Bus:', JSON.stringify(message.body));

    await sender.sendMessages(message);

    context.log('Message sent successfully to Service Bus');
    context.res = { status: 200, body: 'Complaint submitted successfully!' };
  } catch (error) {
    context.log.error('SB SEND ERROR:', { code: error.code, name: error.name, message: error.message });
    // Return the precise reason so you can see it in the browser alert
    if (error.code === 'MODULE_NOT_FOUND' || /Cannot find module/i.test(error.message)) {
      context.res = { status: 500, body: 'Missing dependency @azure/service-bus. Add it to api/package.json and redeploy.' };
    } else {
      context.res = { status: 500, body: `Failed to send to Service Bus: ${error.code || error.name || ''} ${error.message}` };
    }
  } finally {
    try { if (sender) await sender.close(); } catch {}
    try { if (sbClient) await sbClient.close(); } catch {}
  }
};
