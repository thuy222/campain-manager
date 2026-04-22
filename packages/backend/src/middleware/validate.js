const { ZodError } = require("zod");
const AppError = require("../lib/AppError");
const { ErrorCode } = require("../lib/errorCodes");

function formatFieldErrors(zodError) {
  const fieldErrors = {};
  for (const issue of zodError.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

const validate = (schemas) => (req, res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) req.query = schemas.query.parse(req.query);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      return next(
        new AppError(ErrorCode.VALIDATION_ERROR, "Invalid request", 422, formatFieldErrors(err)),
      );
    }
    next(err);
  }
};

module.exports = validate;
