module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./tests/setup-env.js'],
  globalSetup: './tests/global-setup.js',
  globalTeardown: './tests/global-teardown.js',
  testTimeout: 20000,
  // the app keeps BullMQ/Redis connections open, so let Jest exit when tests finish
  forceExit: true,
};
