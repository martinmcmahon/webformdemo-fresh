// api/submitComplaint/SubmitComplaint.js
module.exports = async function (context, req) {
  try {
    // ---- Parse body (JSON or x-www-form-urlencoded) ----
    const ct = ((req?.headers?.['content-type'] || req?.headers?.['Content-Type']) || '').toLowerCase();
    let body = req?.body || {};
    if (typeof body === 'string') {
      if (ct.includes('application/json')) { try { body = JSON.parse(body || '{}'); } catch {} }
      else if (ct.includes('application/x-www-form-urlencoded')) { body = require('querystring').parse(body); }
    }

    const name = (body.name ?? body['applicant-name'] ?? '').toString().trim();
    const complaintDetails = (body.complaintDetails ?? body['complaint-details'] ?? '').toString().trim();

    if (!name || !complaintDetails) {
      context.res = { status: 400, headers: { 'Content-Type': 'text/plain' },
        body: `Please provide both name and complaint details. Keys seen: ${Object.keys(body || {}).join(', ')}` };
      return;
    }

    const connectionString = process.env.CUSTOM_SERVICE_BUS_CONNECTION;
    if (!connectionString) {
      context.res = { status: 500, headers: { 'Content-Type': 'text/plain' },
        body: 'Service Bus connection string is not configured.' };
      return;
    }

    // ---- Service Bus (AMQP over WebSockets on 443) ----
    const { ServiceBusClient } = require('@azure/service-bus');
    const WebSocket = require('ws'); // <- use wss:// over 443

    const sb = new ServiceBusClient(connectionString, {
      webSocketOptions: { webSocket: WebSocket },
      retryOptions: { tryTimeoutInMs: 15000 } // fail fast if unreachable
    });

    const queueName = process.env.SB_QUEUE || 'complaintsqueue';
    const sender = sb.createSender(queueName);

    try {
      await sender.sendMessages({
        body: { name, complaintDetails, timestamp: new Date().toISOString() }
      });

      context.res = { status: 200, headers: { 'Content-Type': 'text/plain' },
        body: 'Complaint submitted successfully!' };
    } catch (e) {
      const msg = (e && (e.code || e.name)) ? `${e.code || e.name}: ${e.message}` : (e?.message || 'Unknown error');
      context.res = { status: 500, headers: { 'Content-Type': 'text/plain' },
        body: `Failed to send to Service Bus: ${msg}` };
    } finally {
      try { await sender.close(); } catch {}
      try { await sb.close(); } catch {}
    }
  } catch (outer) {
    context.res = { status: 500, headers: { 'Content-Type': 'text/plain' },
      body: `Unhandled error: ${outer.name}: ${outer.message}` };
  }
};
