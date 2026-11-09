module.exports = async () => {
  if (globalThis.__TEST_WORKER__) globalThis.__TEST_WORKER__.kill('SIGTERM');
};
