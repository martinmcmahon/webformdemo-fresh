// PROBE 4: send 1 message
module.exports = async function (context, req) {
  try {
    const { ServiceBusClient } = require('@azure/service-bus');
    const sb = new ServiceBusClient(process.env.CUSTOM_SERVICE_BUS_CONNECTION);
    const sender = sb.createSender(process.env.SB_QUEUE || 'complaintsqueue');

    await sender.sendMessages({ body: { ping: true, at: new Date().toISOString() } });

    await sender.close(); await sb.close();
    context.res = { status: 200, headers: { 'Content-Type': 'text/plain' }, body: 'send-ok' };
  } catch (e) {
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: 'send-failed: ' + (e.code || e.name) + ': ' + e.message
    };
  }
};
