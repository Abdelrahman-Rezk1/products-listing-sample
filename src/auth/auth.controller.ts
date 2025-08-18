// src/auth/auth.controller.ts
import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';

const ACCESS_COOKIE = 'zoho_access_token';

@ApiTags('Auth')
@Controller('auth/zoho')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Swagger-friendly: just return the URL as JSON
  @Get()
  @ApiOperation({
    summary: 'Begin Zoho OAuth (Swagger-friendly)',
    description:
      'Returns the Zoho authorize URL as JSON. Copy/paste it into your browser.',
  })
  @ApiQuery({
    name: 'state',
    required: true,
    description: 'State to embed in the authorize URL (dev default shown).',
    schema: { default: 'dev-state', example: 'dev-state' },
  })
  @ApiOkResponse({ description: 'Returns the URL and provided state.' })
  getAuthorizeUrl(@Query('state') state?: string) {
    if (!state) throw new BadRequestException('Missing state');
    return { url: this.auth.buildAuthorizeUrl(state), state };
  }

  // Browser redirect: use this in your app (not via Swagger "Try it out")
  @Get('redirect')
  @ApiOperation({
    summary: 'Begin Zoho OAuth (redirect)',
    description:
      'Redirects the browser to Zoho Accounts. Not suitable for Swagger UI.',
  })
  @ApiQuery({
    name: 'state',
    required: true,
    description: 'State to embed in the authorize URL (dev default shown).',
    schema: { default: 'dev-state', example: 'dev-state' },
  })
  @ApiFoundResponse({ description: 'Redirect to Zoho authorize page.' })
  @ApiBadRequestResponse({ description: 'Missing state.' })
  redirect(@Res() res: Response, @Query('state') state?: string) {
    if (!state) throw new BadRequestException('Missing state');
    const url = this.auth.buildAuthorizeUrl(state);
    return res.redirect(url);
  }

  @Get('callback')
  @ApiOperation({
    summary: 'Zoho OAuth callback',
    description:
      'Exchanges the authorization code for tokens and sets a short-lived HttpOnly access-token cookie.',
  })
  @ApiQuery({
    name: 'code',
    required: true,
    description: 'Authorization code from Zoho',
  })
  @ApiQuery({
    name: 'state',
    required: true,
    description: 'State echoed by Zoho',
    schema: { default: 'dev-state', example: 'dev-state' },
  })
  @ApiFoundResponse({ description: 'Successful auth; redirected to app home.' })
  @ApiBadRequestResponse({ description: 'Missing code or state.' })
  async callback(
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
  ) {
    if (!state) throw new BadRequestException('Missing state');
    if (!code) throw new BadRequestException('Missing authorization code');

    const tokenSet = await this.auth.exchangeCode(code);

    const maxAge = Math.max(tokenSet.expiresAt - Date.now() - 60_000, 0);
    res.cookie(ACCESS_COOKIE, tokenSet.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge,
    });
    // TODO: persist tokenSet.refreshToken + tokenSet.apiDomain server-side
    return res.redirect('/');
  }
}
