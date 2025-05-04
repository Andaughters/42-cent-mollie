'use strict';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const mollieFactory = require('../index').factory;
const MollieGateway = require('../index').MollieGateway;
const createMockMollieClient = require('./mockMollieClient');

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('Mollie Gateway', function() {
  
  let gateway;
  
  before(function() {
    // Create the gateway with a real API key
    gateway = mollieFactory({
      apiKey: 'test_mockkey'
    });
    
    // Replace the client with our mock directly
    gateway.client = createMockMollieClient();
  });
  
  it('should create a gateway instance', function() {
    expect(gateway).to.be.an.instanceof(MollieGateway);
  });
  
  it('should throw an error if apiKey is not provided', function() {
    expect(function() {
      mollieFactory({});
    }).to.throw('apiKey is required for Mollie gateway');
  });
  
  describe('Base Gateway methods', function() {
    it('should properly submit a transaction', function() {
      const order = { amount: 10.00, currency: 'EUR', orderId: '12345' };
      const prospect = { 
        customerFirstName: 'John', 
        customerLastName: 'Doe',
        customerEmail: 'john@example.com'
      };
      
      return gateway.submitTransaction(order, null, prospect, { description: 'Test Payment' })
        .then(result => {
          expect(result).to.be.an('object');
          expect(result.transactionId).to.equal('tr_mockpayment123');
          expect(result.amount).to.equal(10.00);
          expect(result.status).to.equal('pending');
          expect(result.checkoutUrl).to.be.a('string');
        });
    });
    
    it('should properly authorize a transaction', function() {
      const order = { amount: 10.00, currency: 'EUR' };
      
      return gateway.authorizeTransaction(order, null, null)
        .then(result => {
          expect(result).to.be.an('object');
          expect(result.transactionId).to.equal('tr_mockpayment123');
        });
    });
    
    it('should get transaction details', function() {
      return gateway.getTransaction('tr_mockpayment123')
        .then(result => {
          expect(result).to.be.an('object');
          expect(result.transactionId).to.equal('tr_mockpayment123');
          expect(result.amount).to.be.a('number');
        });
    });
    
    it('should refund a transaction', function() {
      return gateway.refundTransaction('tr_mockpayment123', { amount: 5.00, currency: 'EUR' })
        .then(result => {
          expect(result).to.be.an('object');
          expect(result.transactionId).to.equal('rf_mockrefund123');
          expect(result.paymentId).to.equal('tr_mockpayment123');
          expect(result.success).to.be.true;
        });
    });
    
    it('should void/cancel a transaction', function() {
      return gateway.voidTransaction('tr_mockpayment123')
        .then(result => {
          expect(result).to.be.an('object');
          expect(result.transactionId).to.equal('tr_mockpayment123');
          expect(result.success).to.be.true;
        });
    });
    
    it('should create a customer profile', function() {
      const prospect = { 
        customerFirstName: 'John', 
        customerLastName: 'Doe',
        customerEmail: 'john@example.com'
      };
      
      return gateway.createCustomerProfile(null, prospect)
        .then(result => {
          expect(result).to.be.an('object');
          expect(result.profileId).to.equal('cst_mockcustomer123');
          expect(result.success).to.be.true;
        });
    });
    
    it('should create a subscription', function() {
      const prospect = { 
        customerFirstName: 'John', 
        customerLastName: 'Doe',
        customerEmail: 'john@example.com'
      };
      
      const subscriptionPlan = {
        amount: 10.00,
        currency: 'EUR',
        periodLength: 1,
        periodUnit: 'months',
        description: 'Monthly Subscription',
        id: 'plan_123'
      };
      
      return gateway.createSubscription(null, prospect, subscriptionPlan)
        .then(result => {
          expect(result).to.be.an('object');
          expect(result.subscriptionId).to.equal('sub_mocksubscription123');
          expect(result.customerId).to.equal('cst_mockcustomer123');
          expect(result.success).to.be.true;
        });
    });
    
    it('should charge a customer', function() {
      const order = { amount: 10.00, currency: 'EUR', orderId: '12345' };
      
      return gateway.chargeCustomer('cst_mockcustomer123', null, order)
        .then(result => {
          expect(result).to.be.an('object');
          expect(result.transactionId).to.equal('tr_mockpayment123');
          expect(result.profileId).to.equal('cst_mockcustomer123');
          expect(result.amount).to.equal(10.00);
        });
    });
    
    it('should map Mollie statuses to standardized statuses', function() {
      expect(gateway._mapStatus('open')).to.equal('pending');
      expect(gateway._mapStatus('paid')).to.equal('settled');
      expect(gateway._mapStatus('canceled')).to.equal('voided');
      expect(gateway._mapStatus('unknown_status')).to.equal('unknown');
    });
    
    it('should format subscription intervals correctly', function() {
      expect(gateway._mapInterval(1, 'month')).to.equal('1 month');
      expect(gateway._mapInterval(2, 'month')).to.equal('2 months');
      expect(gateway._mapInterval(1, 'months')).to.equal('1 month');
      expect(gateway._mapInterval(3, 'weeks')).to.equal('3 weeks');
    });
  });
});
