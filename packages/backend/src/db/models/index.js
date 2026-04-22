const { sequelize } = require("../sequelize");
const User = require("./user");

function registerAssociations() {
  // future modules will add associations here, e.g.
  // User.hasMany(Campaign, { foreignKey: "created_by", as: "campaigns" });
}

registerAssociations();

module.exports = { sequelize, User };
