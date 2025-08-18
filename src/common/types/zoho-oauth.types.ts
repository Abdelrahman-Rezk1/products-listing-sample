export type ZohoTokenResponse = {
    access_token: string;
    refresh_token?: string;
    // e.g. https://www.zohoapis.sa
    api_domain: string;      
    token_type: 'Bearer';
    // seconds
    expires_in: number;      
    scope?: string;
  };
  
  export type ZohoExchangeResult = {
    accessToken: string;
    refreshToken?: string;
    // epoch ms
    apiDomain: string;
    expiresAt: number;       
    raw: ZohoTokenResponse;
  };
  
  export type ZohoRefreshResult = {
    accessToken: string;
    apiDomain: string;
    expiresAt: number;
    raw: ZohoTokenResponse;
  };
  