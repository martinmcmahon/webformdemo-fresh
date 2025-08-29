// PROBE 2: check env var is visible at runtime
module.exports = async function (context, req) {
  const hasConn = !!process.env.CUSTOM_SERVICE_BUS_CONNECTION;
  context.res = {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
    body: 'env CUSTOM_SERVICE_BUS_CONNECTION = ' + hasConn
  };
};
