export const allowedOrigins: string[];

export interface CommunityHandlerOptions {
  url: string | undefined;
  backendKey: string | undefined;
  publishableKeys: string[];
  origins?: string[];
  fetcher?: typeof fetch;
  cryptoApi?: Crypto;
  now?: () => number;
}

export function createCommunityHandler(
  options: CommunityHandlerOptions,
): (request: Request) => Promise<Response>;
