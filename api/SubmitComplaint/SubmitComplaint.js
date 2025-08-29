// TEMP DEBUG VERSION: always returns 200 so we can see the real error text
module.exports = async function (context, req) {
  const progress = [];
  const say = (text) => {
    context.res = {
      status: 200, // <— forces SWA to show our body instead of "Backend call failure"
      headers: { 'Content-Type': 'text/plain' },
      body: text + '\n\nprogress: ' + progress.join(' > ')
    };
  };

  try {
    progress.push('start');

    // ---- parse body (JSON or form) ----
    const ct = ((req?.headers?.['content-type'] || req?.headers?.['Content-Type']) || '').toLowerCase();
    let body = req?.body || {};
    if (typeof body === 'string') {
      if (ct.includes('application/json')) { try { body = JSON.parse(body || '{}'); } catch {} }
      else if (ct.includes('application/x-www-form-urlencoded')) { body = require('querystring').parse(body); }
    }
    progress.push('parsed');

    const name = (body.name ?? body['applicant-name'] ?? '').toString().trim();
    const complaintDetails = (body.complaintDetails ?? body['complaint-details'] ?? '').toString().trim();
    if (!name || !complaintDetails) return say('ERR: missing fields. keys=' + Object.keys(body).join(', '));
    progress.push('validated');

    // ---- env var ----
    const conn = process.env.CUSTOM_SERVICE_BUS_CONNECTION;
    if (!conn) return say('ERR: CUSTOM_SERVICE_BUS_CONNECTION is not configured');
    progress.push('env-ok');

    // ---- require service-bus ----
    let sb, ServiceBusClient;
    try {
      sb = require('@azure/service-bus');
      ServiceBusClient = sb.ServiceBusClient;
      progress.push('require-sb-ok(keys=' + Object.keys(sb).join(',') + ')');
    } catch (e) {
      return say('ERR: cannot require @azure/service-bus -> ' + (e.code || e.name) + ': ' + e.message);
    }

    // ---- construct client/sender ----
    let sbClient, sender;
    try {
      sbClient = new ServiceBusClient(conn);
      progress.push('client-ok');
      sender = sbClient.createSender(process.env.SB_QUEUE || 'complaintsqueue');
      progress.push('sender-ok');
    } catch (e) {
      return say('ERR: constructing client/sender -> ' + (e.code || e.name) + ': ' + e.message);
    }

    // ---- send ----
    try {
      await sender.sendMessages({ body: { name, complaintDetails, timestamp: new Date().toISOString() } });
      progress.push('sent');
    } catch (e) {
      return say('ERR: sendMessages -> ' + (e.code || e.name) + ': ' + e.message);
    } finally {
      try { await sender?.close(); } catch {}
      try { await sbClient?.close(); } catch {}
      progress.push('closed');
    }

    return say('OK: Complaint submitted successfully!');
  } catch (outer) {
    return say('ERR: unhandled -> ' + (outer.code || outer.name) + ': ' + outer.message);
  }
};
