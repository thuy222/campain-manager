const { UniqueConstraintError } = require("sequelize");
const { User } = require("../../db/models");
const AppError = require("../../lib/AppError");
const { ErrorCode } = require("../../lib/errorCodes");

class AuthRepository {
  async findByEmail(email, tx) {
    const row = await User.findOne({
      where: { email: email.toLowerCase() },
      transaction: tx,
    });
    return row ? row.get({ plain: true }) : null;
  }

  async findById(id, tx) {
    const row = await User.findByPk(id, { transaction: tx });
    return row ? row.get({ plain: true }) : null;
  }

  async create({ email, name, passwordHash }, tx) {
    try {
      const row = await User.create(
        {
          email: email.toLowerCase(),
          name,
          password_hash: passwordHash,
        },
        { transaction: tx },
      );
      return row.get({ plain: true });
    } catch (err) {
      if (err instanceof UniqueConstraintError) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, "Email already registered", 422, {
          email: "already registered",
        });
      }
      throw err;
    }
  }

  async deleteById(id, tx) {
    return User.destroy({ where: { id }, transaction: tx });
  }
}

module.exports = AuthRepository;
