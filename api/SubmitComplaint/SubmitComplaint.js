module.exports = async function (context, req) {
  try {
    const ct = ((req.headers && (req.headers['content-type'] || req.headers['Content-Type'])) || '').toLowerCase();
    let body = req.body || {};
    if (typeof body === 'string') {
      if (ct.includes('application/json')) { try { body = JSON.parse(body || '{}'); } catch {} }
      else if (ct.includes('application/x-www-form-urlencoded')) { body = require('querystring').parse(body); }
    }
    const name = (body.name ?? body['applicant-name'] ?? '').toString().trim();
    const complaintDetails = (body.complaintDetails ?? body['complaint-details'] ?? '').toString().trim();
    if (!name || !complaintDetails) {
      context.res = { status: 400, headers: { 'Content-Type': 'text/plain' },
        body: `Please provide both name and complaint details. Keys seen: ${Object.keys(body).join(', ')}` };
      return;
    }

    const conn = process.env.CUSTOM_SERVICE_BUS_CONNECTION;
    if (!conn) {
      context.res = { status: 500, headers: { 'Content-Type': 'text/plain' }, body: 'Service Bus connection string is not configured.' };
      return;
    }

    try {
      const { ServiceBusClient } = require('@azure/service-bus');
      const sb = new ServiceBusClient(conn);
      const sender = sb.createSender(process.env.SB_QUEUE || 'complaintsqueue');
      await sender.sendMessages({ body: { name, complaintDetails, timestamp: new Date().toISOString() } });
      await sender.close(); await sb.close();
      context.res = { status: 200, headers: { 'Content-Type': 'text/plain' }, body: 'Complaint submitted successfully!' };
    } catch (e) {
      const readable = (e && (e.code || e.name)) ? `${e.code || e.name}: ${e.message}` : (e?.message || 'Unknown error');
      if (e && (e.code === 'MODULE_NOT_FOUND' || /Cannot find module/i.test(e.message))) {
        context.res = { status: 500, headers: { 'Content-Type': 'text/plain' }, body: 'Missing dependency @azure/service-bus. Add it to api/package.json and redeploy.' };
      } else {
        context.res = { status: 500, headers: { 'Content-Type': 'text/plain' }, body: `Failed to send to Service Bus: ${readable}` };
      }
    }
  } catch (outer) {
    context.res = { status: 500, headers: { 'Content-Type': 'text/plain' }, body: `Unhandled error: ${outer.name}: ${outer.message}` };
  }
};
