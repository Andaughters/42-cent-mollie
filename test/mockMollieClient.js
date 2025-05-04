'use strict';

/**
 * Creates a mock Mollie client for testing
 */
module.exports = function createMockMollieClient() {
  const mockPayment = {
    id: 'tr_mockpayment123',
    status: 'open',
    amount: { value: '10.00', currency: 'EUR' },
    getCheckoutUrl: () => 'https://www.mollie.com/checkout/mock-checkout',
    cancel: () => Promise.resolve({ id: 'tr_mockpayment123', status: 'canceled' }),
    refund: (data) => Promise.resolve({
      id: 'rf_mockrefund123',
      amount: data.amount || { value: '10.00', currency: 'EUR' },
      status: 'refunded'
    })
  };

  const mockCustomer = {
    id: 'cst_mockcustomer123',
    name: 'Test Customer',
    email: 'test@example.com',
    createSubscription: (data) => Promise.resolve({
      id: 'sub_mocksubscription123',
      customerId: 'cst_mockcustomer123',
      status: 'active',
      amount: data.amount,
      interval: data.interval
    })
  };

  return {
    payments: {
      create: () => Promise.resolve(mockPayment),
      get: () => Promise.resolve(mockPayment),
      list: () => Promise.resolve({ _embedded: { payments: [mockPayment] } })
    },
    customers: {
      create: () => Promise.resolve(mockCustomer),
      get: () => Promise.resolve(mockCustomer),
      list: () => Promise.resolve({ _embedded: { customers: [mockCustomer] } })
    }
  };
};
