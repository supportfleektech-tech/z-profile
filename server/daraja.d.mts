export function describe(): {
  mode: 'daraja' | 'simulated';
  env: 'sandbox' | 'production';
  missing: string[];
  configured: number;
};
export function isLive(): boolean;
export function stkPush(input: {
  msisdn: string;
  amount: number;
  accountRef?: string;
  description?: string;
  callbackToken?: string;
}): Promise<{ MerchantRequestID?: string; CheckoutRequestID?: string; customerMessage?: string }>;
export function stkQuery(checkoutRequestID: string): Promise<Record<string, unknown>>;
export function receiptJitter(): number;
