// PROBE 1: test require()
module.exports = async function (context, req) {
  try {
    const sb = require('@azure/service-bus');           // <-- just require
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: 'require-ok keys=' + Object.keys(sb).join(',')
    };
  } catch (e) {
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: 'require-failed: ' + (e.code || e.name) + ': ' + e.message
    };
  }
};
