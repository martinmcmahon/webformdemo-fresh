// PROBE 3: construct client (no send)
module.exports = async function (context, req) {
  try {
    const { ServiceBusClient } = require('@azure/service-bus');
    const sb = new ServiceBusClient(process.env.CUSTOM_SERVICE_BUS_CONNECTION);
    await sb.close();
    context.res = { status: 200, headers: { 'Content-Type': 'text/plain' }, body: 'client-ok' };
  } catch (e) {
    context.res = { status: 200, headers: { 'Content-Type': 'text/plain' },
      body: 'client-failed: ' + (e.code || e.name) + ': ' + e.message };
  }
};
