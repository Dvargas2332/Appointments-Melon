import { Body, Controller, Post, BadRequestException } from "@nestjs/common";
import { z, ZodError } from "zod";
import { AuthService } from "../services/auth.service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  // Optional to support "auto-detect kind" on login.
  kind: z.enum(["client", "business"]).optional(),
});

const oauthExchangeSchema = z.object({
  accessToken: z.string().min(1).optional(),
  idToken: z.string().min(1).optional(),
  provider: z.enum(["kazehana", "google", "apple", "line", "x"]).optional(),
  kind: z.enum(["client", "business"]).optional(),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  login(@Body() body: unknown) {
    try {
      const input = loginSchema.parse(body);
      return this.auth.login(input);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException(err.issues);
      }
      throw err;
    }
  }

  @Post("oauth/exchange")
  exchange(@Body() body: unknown) {
    try {
      const input = oauthExchangeSchema.parse(body);
      return this.auth.exchangeOAuth(input);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException(err.issues);
      }
      throw err;
    }
  }

  @Post("refresh")
  refresh(@Body() body: unknown) {
    try {
      const input = refreshSchema.parse(body);
      return this.auth.refreshAccessToken(input.refreshToken);
    } catch (err) {
      if (err instanceof ZodError) throw new BadRequestException(err.issues);
      throw err;
    }
  }

  @Post("forgot-password")
  forgotPassword(@Body() body: unknown) {
    try {
      const input = forgotPasswordSchema.parse(body);
      return this.auth.forgotPassword(input.email);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException(err.issues);
      }
      throw err;
    }
  }
}
