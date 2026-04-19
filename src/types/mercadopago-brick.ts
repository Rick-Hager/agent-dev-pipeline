export interface CardFormData {
  token: string;
  payment_method_id: string;
  issuer_id: string;
  installments: number;
}

export interface BrickCallbacks {
  onReady: () => void;
  onSubmit: (formData: CardFormData) => Promise<void> | void;
  onError?: (error: { message?: string }) => void;
}

export interface BrickController {
  unmount: () => void;
}

export interface BricksBuilder {
  create(
    brickType: "cardPayment",
    containerId: string,
    settings: {
      initialization: { amount: number };
      customization?: {
        paymentMethods?: { maxInstallments?: number };
      };
      callbacks: BrickCallbacks;
    }
  ): Promise<BrickController>;
}

export interface MercadoPagoSDK {
  bricks(): BricksBuilder;
}

export interface MercadoPagoSDKClass {
  new (publicKey: string, options?: { locale?: string }): MercadoPagoSDK;
}

declare global {
  interface Window {
    MercadoPago?: MercadoPagoSDKClass;
  }
}

export {};
