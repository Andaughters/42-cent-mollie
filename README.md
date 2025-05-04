# 42-cent-mollie

[Mollie](https://www.mollie.com/) payment gateway for [42-cent](https://github.com/continuous-software/42-cent).

## Installation

```bash
npm install -s 42-cent-mollie
```

## Usage

```javascript
var Gateways = require('42-cent');
var client = Gateways.use('Mollie', {
  apiKey: 'your_mollie_api_key'
});

// To register the gateway with 42-cent (if not already included in 42-cent):
var mollieGateway = require('42-cent-mollie');
Gateways.registerGateway('Mollie', mollieGateway.factory);
```

### Credentials

| Field | Description |
|-------|-------------|
| apiKey | Your Mollie API key (starts with test\_for test mode or live\_ for production) |

## API Documentation

### Gateway API

This library implements the 42-cent base gateway interface. Refer to [BaseGateway](https://github.com/continuous-software/42-cent-base) for detailed API documentation.

### Mollie-specific Features

Mollie provides several payment methods beyond credit card processing, including:

- iDEAL
- Bancontact
- Credit Card
- PayPal
- SOFORT Banking
- and many more

To specify a payment method when creating a transaction, use the `other` parameter:

```javascript
client.submitTransaction(order, null, prospect, {
  paymentMethod: 'ideal', // or 'creditcard', 'paypal', etc.
  // Other Mollie-specific options...
});
```

## Testing

To run the tests:

```bash
npm test
```

## License

MIT
