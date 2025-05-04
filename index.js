'use strict';

const MollieGateway = require('./lib/MollieGateway');

/**
 * Creates and returns a new Mollie gateway instance
 * @param {Object} options - Configuration options
 * @param {String} options.apiKey - Your Mollie API key
 * @returns {MollieGateway} A Mollie gateway instance
 */
exports.factory = function factory(options) {
  return new MollieGateway(options);
};

exports.MollieGateway = MollieGateway;
