const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../sequelize");

class CampaignRecipient extends Model {}

CampaignRecipient.init(
  {
    campaign_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
    recipient_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
    status: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "pending",
      validate: { isIn: [["pending", "sent", "failed"]] },
    },
    sent_at: { type: DataTypes.DATE, allowNull: true },
    opened_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "CampaignRecipient",
    tableName: "campaign_recipients",
    underscored: true,
    timestamps: false,
  },
);

module.exports = CampaignRecipient;
