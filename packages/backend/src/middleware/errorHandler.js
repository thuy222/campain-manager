const AppError = require("../lib/AppError");
const { ErrorCode } = require("../lib/errorCodes");

function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    const body = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error.details = err.details;
    return res.status(err.status).json(body);
  }

  // Never leak unexpected errors. Log server-side, return a generic envelope.
  // Zod errors reach here only if a handler calls .parse() directly instead
  // of going through the `validate` middleware — which is a bug, and the
  // generic 500 is correct until the route is fixed.
  // eslint-disable-next-line no-console
  console.error("[unhandled error]", err);
  res.status(500).json({
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: "Internal server error",
    },
  });
}

module.exports = errorHandler;
