module.exports = async function (context, req) {
  context.log('Function triggered for /api/submitComplaint');
// add:
const ct = ((req.headers && (req.headers['content-type'] || req.headers['Content-Type'])) || '').toLowerCase();
context.log('Content-Type:', ct, '| typeof req.body:', typeof req.body);
context.log('Body keys:', req && req.body && typeof req.body === 'object' ? Object.keys(req.body) : 'n/a');


  const connectionString = process.env.CUSTOM_SERVICE_BUS_CONNECTION;
  context.log('HAS_CUSTOM_SERVICE_BUS_CONNECTION', !!process.env.CUSTOM_SERVICE_BUS_CONNECTION);
  context.log(`Service Bus connection string: ${connectionString ? 'Found' : 'Not found'}`);
  if (!connectionString) {
    context.log('Error: Service Bus connection string is missing');
    context.res = {
      status: 500,
      body: "Service Bus connection string is not configured."
    };
    return;
  }

  //const { name, complaintDetails } = req.body || {};
  //context.log(`Received request body: ${JSON.stringify(req.body)}`);
  //if (!name || !complaintDetails) {
  //  context.log('Error: Missing name or complaintDetails in request body');
  //  context.res = {
  //    status: 400,
  //    body: "Please provide both name and complaint details."
//    };
  //  return;
  //}

let body = req.body || {};
if (typeof body === 'string') {
  if (ct.includes('application/json')) {
    try { body = JSON.parse(body || '{}'); } catch {}
  } else if (ct.includes('application/x-www-form-urlencoded')) {
    const qs = require('querystring');
    body = qs.parse(body);
  }
}

// accept either JSON keys or your current form field names (native POST)
const name = (body.name ?? body['applicant-name'] ?? '').toString().trim();
const complaintDetails = (body.complaintDetails ?? body['complaint-details'] ?? '').toString().trim();

// optional debug (keep for now)
context.log('CT:', ct, '| keys:', Object.keys(body));

if (!name || !complaintDetails) {
  context.res = {
    status: 400,
    body: `Please provide both name and complaint details. Keys seen: ${Object.keys(body).join(', ')}`
  };
  return;
}

  context.log(`Processing submission for name: ${name}, details: ${complaintDetails}`);
  const { ServiceBusClient } = require('@azure/service-bus');
  const sbClient = new ServiceBusClient(connectionString);
  const sender = sbClient.createSender('complaintsqueue');

  try {
    const message = {
      body: {
        name,
        complaintDetails,
        timestamp: new Date().toISOString()
      }
    };
    context.log(`Sending message to Service Bus: ${JSON.stringify(message.body)}`);
    await sender.sendMessages(message);
    context.log('Message sent successfully to Service Bus');
    context.res = {
      status: 200,
      body: "Complaint submitted successfully!"
    };
  } catch (error) {
    context.log(`Error sending to Service Bus: ${error.message}`);
    context.res = {
      status: 500,
      body: `Failed to submit complaint: ${error.message}`
    };
  } finally {
    context.log('Closing Service Bus client and sender');
    await sender.close();
    await sbClient.close();
  }
};