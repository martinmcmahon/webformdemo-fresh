// api/submitComplaint/SubmitComplaint.js
module.exports = async function (context, req) {
  try {
    // ---- Parse body (works for JSON and form-POST) ----
    var ct = '';
    if (req && req.headers) ct = (req.headers['content-type'] || req.headers['Content-Type'] || '').toLowerCase();

    var body = (req && req.body) ? req.body : {};
    if (typeof body === 'string') {
      if (ct.indexOf('application/json') > -1) {
        try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; }
      } else if (ct.indexOf('application/x-www-form-urlencoded') > -1) {
        body = require('querystring').parse(body);
      }
    }

    var name = ((body && body.name) || (body && body['applicant-name']) || '').toString().trim();
    var complaintDetails = ((body && body.complaintDetails) || (body && body['complaint-details']) || '').toString().trim();

    if (!name || !complaintDetails) {
      context.res = { status: 400, headers: {'Content-Type':'text/plain'}, body: 'Missing required fields: name, complaintDetails.' };
      return;
    }

    // ---- Env var ----
    var conn = process.env.CUSTOM_SERVICE_BUS_CONNECTION;
    if (!conn) {
      context.res = { status: 500, headers: {'Content-Type':'text/plain'}, body: 'Service Bus connection string is not configured.' };
      return;
    }

    // ---- Service Bus send (fully wrapped) ----
    try {
      var sb = require('@azure/service-bus');                            // catches if module missing
      var sbClient = new sb.ServiceBusClient(conn);
      var sender = sbClient.createSender(process.env.SB_QUEUE || 'complaintsqueue');

      await sender.sendMessages({
        body: { name: name, complaintDetails: complaintDetails, timestamp: new Date().toISOString() }
      });

      try { await sender.close(); } catch (e) {}
      try { await sbClient.close(); } catch (e) {}

      context.res = { status: 200, headers: {'Content-Type':'text/plain'}, body: 'Complaint submitted successfully!' };
    } catch (e) {
      var msg = (e && (e.code || e.name)) ? (e.code || e.name) + ': ' + e.message
                                           : (e && e.message) ? e.message : 'Unknown error';
      if (e && (e.code === 'MODULE_NOT_FOUND' || /Cannot find module/i.test(msg))) {
        context.res = { status: 500, headers: {'Content-Type':'text/plain'},
          body: 'Missing dependency @azure/service-bus. Add it to api/package.json and redeploy.' };
      } else {
        context.res = { status: 500, headers: {'Content-Type':'text/plain'},
          body: 'Failed to send to Service Bus: ' + msg };
      }
    }
  } catch (outer) {
    // absolute last resort
    context.res = { status: 500, headers: {'Content-Type':'text/plain'}, body: 'Unhandled error: ' + outer.message };
  }
};
