import { Inject, Injectable } from '@nestjs/common';
import zohoConfig from '../configs/zoho.config';
import {
  ZohoTokenResponse,
  ZohoExchangeResult,
  ZohoRefreshResult,
} from '../common/types/zoho-oauth.types';
import { ConfigType } from '@nestjs/config';

// src/auth/auth.service.ts

@Injectable()
export class AuthService {
  constructor(
    @Inject(zohoConfig.KEY) private readonly cfg: ConfigType<typeof zohoConfig>,
  ) {}

  buildAuthorizeUrl(state: string): string {
    const p = new URLSearchParams({
      scope: this.cfg.scopes,
      client_id: this.cfg.clientID,
      response_type: 'code',
      redirect_uri: this.cfg.redirectURI,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${this.cfg.accounts}/oauth/v2/auth?${p.toString()}`;
  }

  async exchangeCode(code: string): Promise<ZohoExchangeResult> {
    const url = `${this.cfg.accounts}/oauth/v2/token`;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.cfg.clientID,
      client_secret: this.cfg.secret,
      redirect_uri: this.cfg.redirectURI,
      code,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`Zoho token error ${res.status}: ${text}`);

    const data = JSON.parse(text) as ZohoTokenResponse;
    const expiresAt = Date.now() + data.expires_in * 1000;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      apiDomain: data.api_domain,
      expiresAt,
      raw: data,
    };
  }

  async refreshWithToken(refreshToken: string): Promise<ZohoRefreshResult> {
    const url = `${this.cfg.accounts}/oauth/v2/token`;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.cfg.clientID,
      client_secret: this.cfg.secret,
      refresh_token: refreshToken,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const text = await res.text();
    if (!res.ok) throw new Error(`Zoho token error ${res.status}: ${text}`);

    const data = JSON.parse(text) as ZohoTokenResponse;
    const expiresAt = Date.now() + data.expires_in * 1000;

    return {
      accessToken: data.access_token,
      apiDomain: data.api_domain,
      expiresAt,
      raw: data,
    };
  }

  isAccessTokenExpired(expiresAt?: number, skewMs = 60_000) {
    if (!expiresAt) return true;
    return Date.now() + skewMs >= expiresAt;
  }
}
