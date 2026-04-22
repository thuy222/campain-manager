const bcrypt = require("bcrypt");
const { UniqueConstraintError } = require("sequelize");
const AppError = require("../../lib/AppError");
const { ErrorCode } = require("../../lib/errorCodes");

const BCRYPT_COST = 10;

// Structurally-valid bcrypt hash of an unguessable throwaway value. Used as a
// stand-in when a login targets a non-existent user so the bcrypt.compare path
// takes the same time as a real miss — keeps the generic failure (criterion 4)
// timing-stable.
const DUMMY_BCRYPT_HASH = bcrypt.hashSync(
  "unreachable-sentinel-never-a-real-password",
  BCRYPT_COST,
);

class AuthService {
  constructor(repository) {
    this.repository = repository;
  }

  toPublicUser(row) {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      created_at: row.created_at,
    };
  }

  async register({ email, name, password }) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    try {
      const row = await this.repository.create({
        email,
        name,
        passwordHash,
      });
      return this.toPublicUser(row);
    } catch (err) {
      if (err instanceof UniqueConstraintError) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, "Email already registered", 422, {
          email: "already registered",
        });
      }
      throw err;
    }
  }

  async login({ email, password }) {
    const row = await this.repository.findByEmail(email);
    // Identical failure path for unknown email vs wrong password — the system
    // must not reveal which was wrong (acceptance criterion 4). Always run the
    // bcrypt compare to keep timing similar.
    const hash = row ? row.password_hash : DUMMY_BCRYPT_HASH;
    const ok = await bcrypt.compare(password, hash);
    if (!row || !ok) {
      throw new AppError(ErrorCode.AUTH_REQUIRED, "Invalid email or password", 401);
    }
    return this.toPublicUser(row);
  }
}

module.exports = AuthService;
