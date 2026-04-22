module.exports = async function globalTeardown() {
  // no-op; each test file closes its own sequelize instance via afterAll.
};
