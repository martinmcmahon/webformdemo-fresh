module.exports = async function (context, req) {
  context.res = { status: 200, headers: { 'Content-Type': 'text/plain' }, body: 'OK from submitComplaint' };
};
