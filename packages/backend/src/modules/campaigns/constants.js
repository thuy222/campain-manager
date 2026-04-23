// Cap per-campaign recipient count. Enforced in DTOs (create + update) so both
// write paths reject oversized payloads with the same message.
const MAX_RECIPIENTS = 100;

module.exports = { MAX_RECIPIENTS };
