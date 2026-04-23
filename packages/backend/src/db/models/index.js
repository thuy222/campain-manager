const { sequelize } = require("../sequelize");
const User = require("./user");
const Campaign = require("./campaign");
const Recipient = require("./recipient");
const CampaignRecipient = require("./campaignRecipient");

function registerAssociations() {
  User.hasMany(Campaign, { foreignKey: "created_by", as: "campaigns" });
  Campaign.belongsTo(User, { foreignKey: "created_by", as: "owner" });

  Campaign.belongsToMany(Recipient, {
    through: CampaignRecipient,
    foreignKey: "campaign_id",
    otherKey: "recipient_id",
    as: "recipients",
  });
  Recipient.belongsToMany(Campaign, {
    through: CampaignRecipient,
    foreignKey: "recipient_id",
    otherKey: "campaign_id",
    as: "campaigns",
  });

  Campaign.hasMany(CampaignRecipient, {
    foreignKey: "campaign_id",
    as: "recipient_links",
  });
  CampaignRecipient.belongsTo(Campaign, { foreignKey: "campaign_id" });
  CampaignRecipient.belongsTo(Recipient, { foreignKey: "recipient_id" });
}

registerAssociations();

module.exports = { sequelize, User, Campaign, Recipient, CampaignRecipient };
