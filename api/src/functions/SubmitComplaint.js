module.exports = async function (context, req) {
  context.log('JavaScript HTTP trigger function processed a request.');

  const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING;
  if (!connectionString) {
    context.res = {
      status: 500,
      body: "Service Bus connection string is not configured."
    };
    return;
  }

  const { name, complaintDetails } = req.body || {};
  if (!name || !complaintDetails) {
    context.res = {
      status: 400,
      body: "Please provide both name and complaint details."
    };
    return;
  }

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
    await sender.sendMessages(message);
    context.res = {
      status: 200,
      body: "Complaint submitted successfully!"
    };
  } catch (error) {
    context.res = {
      status: 500,
      body: `Failed to submit complaint: ${error.message}`
    };
  } finally {
    await sender.close();
    await sbClient.close();
  }
};