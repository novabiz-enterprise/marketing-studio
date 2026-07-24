import type { PaymentProvider } from './types';
import { stripeProvider } from './stripe';
import { redeemProvider } from './redeem';

export type { PaymentProvider, CheckoutArgs } from './types';

function selected(): string {
  return (process.env.PAYMENT_PROVIDER || 'stripe').toLowerCase();
}

export function paymentProvider(): PaymentProvider {
  return selected() === 'redeem' ? redeemProvider : stripeProvider;
}

export function paymentMode(): 'checkout' | 'redeem' {
  return selected() === 'redeem' ? 'redeem' : 'checkout';
}
