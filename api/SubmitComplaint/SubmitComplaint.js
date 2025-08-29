module.exports = async function (context, req) {
  try {
    // ---- parse body (JSON or x-www-form-urlencoded) ----
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
        body: `Please provide both name and complaint details. Keys: ${Object.keys(body).join(', ')}` };
      return;
    }

    const conn = process.env.CUSTOM_SERVICE_BUS_CONNECTION;
    if (!conn) {
      context.res = { status: 500, headers: { 'Content-Type': 'text/plain' },
        body: 'Service Bus connection string is not configured.' };
      return;
    }

    // ---- Service Bus over WebSockets (port 443) ----
    const { ServiceBusClient } = require('@azure/service-bus');
    const WebSocket = require('ws');

    const sb = new ServiceBusClient(conn, {
      webSocketOptions: { webSocket: WebSocket },     // <- force WSS
      retryOptions: { tryTimeoutInMs: 10000 }         // fail fast; avoids silent 500s
    });

    const queueName = process.env.SB_QUEUE || 'complaintsqueue';
    const sender = sb.createSender(queueName);

    try {
      await sender.sendMessages({ body: { name, complaintDetails, timestamp: new Date().toISOString() } });
      context.res = { status: 200, headers: { 'Content-Type': 'text/plain' }, body: 'Complaint submitted successfully!' };
    } catch (e) {
      const msg = (e && (e.code || e.name)) ? `${e.code || e.name}: ${e.message}` : (e?.message || 'Unknown error');
      context.res = { status: 500, headers: { 'Content-Type': 'text/plain' }, body: `Failed to send to Service Bus: ${msg}` };
    } finally {
      try { await sender.close(); } catch {}
      try { await sb.close(); } catch {}
    }
  } catch (outer) {
    context.res = { status: 500, headers: { 'Content-Type': 'text/plain' }, body: `Unhandled: ${outer.name}: ${outer.message}` };
  }
};
