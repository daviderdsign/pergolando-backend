import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import {
  SessionAuthGuard,
  type RequestWithSeller,
} from './guards/session-auth.guard.js';
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from './auth.constants.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const seller = await this.authService.register(dto);
    return { seller };
  }

  // Per-IP throttle in addition to the per-account lockout in AuthService.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { seller, sessionId } = await this.authService.login(dto);
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.SESSION_COOKIE_SECURE !== 'false',
      sameSite: 'lax',
      maxAge: SESSION_TTL_MS,
    });
    return { seller };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    if (sessionId) await this.authService.logout(sessionId);
    res.clearCookie(SESSION_COOKIE_NAME);
  }

  @UseGuards(SessionAuthGuard)
  @Get('me')
  me(@Req() req: RequestWithSeller) {
    return { seller: req.seller };
  }
}
