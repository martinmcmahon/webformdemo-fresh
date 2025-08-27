module.exports = async function (context, req) {
  context.log('Function triggered for /api/submitComplaint');

  const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
  context.log(`Service Bus connection string: ${connectionString ? 'Found' : 'Not found'}`);
  if (!connectionString) {
    context.log('Error: Service Bus connection string is missing');
    context.res = {
      status: 500,
      body: "Service Bus connection string is not configured."
    };
    return;
  }

  const { name, complaintDetails } = req.body || {};
  context.log(`Received request body: ${JSON.stringify(req.body)}`);
  if (!name || !complaintDetails) {
    context.log('Error: Missing name or complaintDetails in request body');
    context.res = {
      status: 400,
      body: "Please provide both name and complaint details."
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