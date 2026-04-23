const { DataTypes, Model } = require("sequelize");
const { sequelize } = require("../sequelize");

class Recipient extends Model {}

Recipient.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(320),
      allowNull: false,
      unique: true,
    },
    name: { type: DataTypes.STRING(255), allowNull: true },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "Recipient",
    tableName: "recipients",
    underscored: true,
    timestamps: false,
  },
);

module.exports = Recipient;
