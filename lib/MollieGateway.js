'use strict';

const BaseGateway = require('42-cent-base').BaseGateway;
const { createMollieClient } = require('@mollie/api-client');
const assert = require('assert');

/**
 * MollieGateway - Implementation of 42-cent BaseGateway for Mollie Payment Service
 * @class MollieGateway
 * @extends {BaseGateway}
 */
class MollieGateway extends BaseGateway {
  /**
   * Creates an instance of MollieGateway
   * @param {Object} options - Configuration options
   * @param {String} options.apiKey - Your Mollie API key
   */
  constructor(options) {
    super();
    assert(options.apiKey, 'apiKey is required for Mollie gateway');
    this.client = createMollieClient({ apiKey: options.apiKey });
  }

  /**
   * Create and submit a payment transaction to Mollie
   * @param {Object} order - Order information including amount
   * @param {Object} creditCard - Credit card information (not directly used by Mollie)
   * @param {Object} prospect - Customer information
   * @param {Object} [other] - Additional options
   * @param {String} [other.paymentMethod] - Mollie payment method (e.g., 'ideal', 'creditcard')
   * @param {String} [other.description] - Payment description
   * @param {String} [other.redirectUrl] - URL the customer will be redirected to after payment
   * @param {String} [other.webhookUrl] - URL Mollie will call to notify about payment status changes
   * @returns {Promise<Object>} Transaction result object
   */
  submitTransaction(order, creditCard, prospect, other = {}) {
    const paymentData = {
      amount: {
        currency: order.currency || 'EUR',
        value: parseFloat(order.amount).toFixed(2)
      },
      description: other.description || `Order ${order.orderId || new Date().getTime()}`,
      redirectUrl: other.redirectUrl,
      webhookUrl: other.webhookUrl
    };

    if (other.paymentMethod) {
      paymentData.method = other.paymentMethod;
    }

    // Add metadata from prospect/order if available
    if (prospect || order) {
      paymentData.metadata = {};

      if (prospect) {
        if (prospect.customerFirstName || prospect.customerLastName) {
          paymentData.metadata.customerName = `${prospect.customerFirstName || ''} ${prospect.customerLastName || ''}`.trim();
        }
        if (prospect.customerEmail) {
          paymentData.metadata.customerEmail = prospect.customerEmail;
        }
      }

      if (order.orderId) {
        paymentData.metadata.orderId = order.orderId;
      }
    }

    return this.client.payments.create(paymentData)
      .then(payment => {
        return {
          _original: payment,
          transactionId: payment.id,
          amount: order.amount,
          status: this._mapStatus(payment.status),
          // Include checkout URL for redirect-based payments
          checkoutUrl: payment.getCheckoutUrl(),
          // Mollie payment is typically not complete immediately (requires redirect)
          captured: false,
          success: payment.status === 'paid'
        };
      });
  }

  /**
   * Authorize a transaction (creates payment but doesn't capture funds)
   * Note: This implementation is similar to submitTransaction since Mollie doesn't directly support separate auth/capture
   * @param {Object} order - Order information including amount
   * @param {Object} creditCard - Credit card information
   * @param {Object} prospect - Customer information
   * @param {Object} [other] - Additional options
   * @returns {Promise<Object>} Transaction result object
   */
  authorizeTransaction(order, creditCard, prospect, other = {}) {
    // Since Mollie doesn't have a true authorize/capture flow like traditional processors,
    // we'll create a payment that requires manual capture later
    return this.submitTransaction(order, creditCard, prospect, other);
  }

  /**
   * Get transaction details
   * @param {String} transactionId - The Mollie payment ID
   * @returns {Promise<Object>} Transaction details
   */
  getTransaction(transactionId) {
    return this.client.payments.get(transactionId)
      .then(payment => {
        return {
          _original: payment,
          transactionId: payment.id,
          amount: parseFloat(payment.amount.value),
          status: this._mapStatus(payment.status),
          captured: payment.status === 'paid',
          success: ['paid', 'authorized'].includes(payment.status)
        };
      });
  }

  /**
   * Refund a transaction
   * @param {String} transactionId - The Mollie payment ID
   * @param {Object} [options] - Additional options
   * @param {Number} [options.amount] - Amount to refund (if partial refund)
   * @returns {Promise<Object>} Refund result
   */
  refundTransaction(transactionId, options = {}) {
    const refundData = {};
    
    if (options.amount) {
      refundData.amount = {
        currency: options.currency || 'EUR',
        value: parseFloat(options.amount).toFixed(2)
      };
    }

    if (options.description) {
      refundData.description = options.description;
    }

    return this.client.payments.get(transactionId)
      .then(payment => {
        return payment.refund(refundData);
      })
      .then(refund => {
        return {
          _original: refund,
          transactionId: refund.id,
          paymentId: transactionId,
          amount: parseFloat(refund.amount.value),
          success: true
        };
      });
  }

  /**
   * Void/cancel a transaction
   * Note: In Mollie, you can only cancel payments that haven't been paid yet
   * @param {String} transactionId - The Mollie payment ID
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Void result
   */
  voidTransaction(transactionId, options = {}) {
    return this.client.payments.get(transactionId)
      .then(payment => {
        return payment.cancel();
      })
      .then(canceledPayment => {
        return {
          _original: canceledPayment,
          transactionId: canceledPayment.id,
          success: canceledPayment.status === 'canceled'
        };
      })
      .catch(error => {
        // Mollie only allows canceling certain payment statuses
        if (error.message.includes('cannot be canceled')) {
          return {
            transactionId,
            success: false,
            message: error.message
          };
        }
        throw error;
      });
  }

  /**
   * Create a subscription for recurring payments
   * @param {Object} creditCard - Credit card information (not directly used by Mollie)
   * @param {Object} prospect - Customer information
   * @param {Object} subscriptionPlan - Subscription details
   * @param {Object} [other] - Additional options
   * @returns {Promise<Object>} Subscription result
   */
  createSubscription(creditCard, prospect, subscriptionPlan, other = {}) {
    // First create a customer if customerId is not provided
    const customerId = other.customerId || null;
    const createCustomerIfNeeded = customerId 
      ? Promise.resolve({ id: customerId }) 
      : this.createCustomerProfile(creditCard, prospect, other).then(result => ({ id: result.profileId }));
    
    return createCustomerIfNeeded.then(customer => {
      const subscriptionData = {
        amount: {
          currency: subscriptionPlan.currency || 'EUR',
          value: parseFloat(subscriptionPlan.amount).toFixed(2)
        },
        interval: this._mapInterval(subscriptionPlan.periodLength, subscriptionPlan.periodUnit || 'months'),
        description: subscriptionPlan.description || 'Subscription',
        metadata: { planId: subscriptionPlan.id }
      };

      if (other.webhookUrl) {
        subscriptionData.webhookUrl = other.webhookUrl;
      }
      
      return this.client.customers.get(customer.id)
        .then(customer => customer.createSubscription(subscriptionData))
        .then(subscription => {
          return {
            _original: subscription,
            subscriptionId: subscription.id,
            customerId: customer.id,
            planId: subscriptionPlan.id,
            status: subscription.status,
            success: true
          };
        });
    });
  }

  /**
   * Create a customer profile for future charges
   * @param {Object} creditCard - Credit card information (not directly used by Mollie)
   * @param {Object} prospect - Customer information
   * @param {Object} [other] - Additional options
   * @returns {Promise<Object>} Customer profile result
   */
  createCustomerProfile(creditCard, prospect, other = {}) {
    const customerData = {
      name: prospect.customerName || `${prospect.customerFirstName || ''} ${prospect.customerLastName || ''}`.trim(),
      email: prospect.customerEmail
    };

    if (other.metadata) {
      customerData.metadata = other.metadata;
    }

    return this.client.customers.create(customerData)
      .then(customer => {
        return {
          _original: customer,
          profileId: customer.id,
          success: true
        };
      });
  }

  /**
   * Charge a customer using a saved profile
   * @param {String} profileId - The Mollie customer ID
   * @param {String} paymentProfileId - Not directly used by Mollie
   * @param {Object} order - Order information
   * @param {Object} [other] - Additional options
   * @returns {Promise<Object>} Transaction result
   */
  chargeCustomer(profileId, paymentProfileId, order, other = {}) {
    const paymentData = {
      customerId: profileId,
      amount: {
        currency: order.currency || 'EUR',
        value: parseFloat(order.amount).toFixed(2)
      },
      description: other.description || `Order ${order.orderId || new Date().getTime()}`,
      redirectUrl: other.redirectUrl,
      webhookUrl: other.webhookUrl
    };

    if (other.paymentMethod) {
      paymentData.method = other.paymentMethod;
    }

    // Add metadata
    paymentData.metadata = { orderId: order.orderId };

    return this.client.payments.create(paymentData)
      .then(payment => {
        return {
          _original: payment,
          transactionId: payment.id,
          profileId: profileId,
          amount: order.amount,
          status: this._mapStatus(payment.status),
          checkoutUrl: payment.getCheckoutUrl(),
          captured: payment.status === 'paid',
          success: payment.status === 'paid'
        };
      });
  }

  /**
   * Map Mollie payment status to standardized status format
   * @private
   * @param {String} mollieStatus - Mollie payment status
   * @returns {String} Standardized status
   */
  _mapStatus(mollieStatus) {
    const statusMap = {
      'open': 'pending',
      'pending': 'pending',
      'authorized': 'authorized',
      'paid': 'settled',
      'expired': 'failed',
      'canceled': 'voided',
      'failed': 'failed'
    };

    return statusMap[mollieStatus] || 'unknown';
  }

  /**
   * Map subscription interval to Mollie format
   * @private
   * @param {Number} length - Interval length
   * @param {String} unit - Interval unit (days, weeks, months, years)
   * @returns {String} Mollie-formatted interval
   */
  _mapInterval(length, unit) {
    length = parseInt(length, 10) || 1;
    
    // Mollie uses format like "1 month" or "2 weeks"
    // Convert unit to singular if length is 1
    if (length === 1) {
      return `${length} ${unit.replace(/s$/, '')}`;
    }
    
    // Make sure unit ends with 's' for plural
    if (!unit.endsWith('s')) {
      unit = `${unit}s`;
    }
    
    return `${length} ${unit}`;
  }
}

module.exports = MollieGateway;
