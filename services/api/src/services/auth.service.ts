import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { compare, hash } from "bcryptjs";
import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";
import jwt, { SignOptions } from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { UserBusiness, UserClient, UserRole } from "@prisma/client";
import { AuthPayload } from "../types/auth-user";
import { PrismaService } from "./prisma.service";

const REFRESH_TOKEN_EXPIRY = "30d";
const ACCESS_TOKEN_EXPIRY_DEFAULT = "7d";

type LoginInput = { email: string; password: string; kind?: "client" | "business" };

type OAuthExchangeInput = {
  accessToken?: string;
  idToken?: string;
  provider?: "kazehana" | "google" | "apple" | "line" | "x";
  kind?: "client" | "business";
  email?: string;
  name?: string;
};

type ProviderKey = "kazehana" | "google" | "apple" | "line" | "x";

type OAuthProviderRuntimeConfig = {
  key: ProviderKey;
  issuer?: string;
  jwksUri?: string;
  audiences: string[];
};

type ResolvedUser =
  | { kind: "client"; user: UserClient }
  | { kind: "business"; user: UserBusiness };

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(input: LoginInput) {
    try {
      if (input.kind) {
        if (input.kind === "client") {
          const user = await this.prisma.userClient.findUnique({ where: { email: input.email } });
          if (!user) throw new UnauthorizedException("Credenciales invalidas");
          const ok = await compare(input.password, user.password);
          if (!ok) throw new UnauthorizedException("Credenciales invalidas");
          return this.issueSession({ id: user.id, email: user.email, kind: "client" });
        }

        const user = await this.prisma.userBusiness.findUnique({ where: { email: input.email } });
        if (!user) throw new UnauthorizedException("Credenciales invalidas");
        const ok = await compare(input.password, user.password);
        if (!ok) throw new UnauthorizedException("Credenciales invalidas");
        return this.issueSession({ id: user.id, email: user.email, kind: "business", role: user.role });
      }

      const [clientUser, businessUser] = await Promise.all([
        this.prisma.userClient.findUnique({ where: { email: input.email } }),
        this.prisma.userBusiness.findUnique({ where: { email: input.email } }),
      ]);

      const clientOk = clientUser ? await compare(input.password, clientUser.password) : false;
      const businessOk = businessUser ? await compare(input.password, businessUser.password) : false;

      if (clientOk && !businessOk) {
        return this.issueSession({ id: clientUser!.id, email: clientUser!.email, kind: "client" });
      }
      if (businessOk && !clientOk) {
        return this.issueSession({
          id: businessUser!.id,
          email: businessUser!.email,
          kind: "business",
          role: businessUser!.role,
        });
      }
      if (clientOk && businessOk) {
        throw new UnauthorizedException("Cuenta ambigua: existe como cliente y como empresa. Contacta soporte.");
      }

      throw new UnauthorizedException("Credenciales invalidas");
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof BadRequestException) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : "No se pudo iniciar sesion";
      throw new UnauthorizedException(msg);
    }
  }

  async exchangeOAuth(input: OAuthExchangeInput) {
    const rawToken = input.idToken || input.accessToken;
    if (!rawToken) {
      throw new BadRequestException("Debes enviar idToken o accessToken");
    }

    const providerKey = input.provider || "kazehana";
    const claims = await this.verifyOAuthToken(rawToken, providerKey);
    const email = this.resolveStringClaim(claims.email) || input.email;
    const name = this.resolveStringClaim(claims.name) || input.name;

    if (!email) {
      throw new UnauthorizedException("El proveedor OAuth no devolvio un email utilizable");
    }

    const resolved = await this.findOrProvisionOAuthUser({
      email,
      name,
      requestedKind: input.kind,
    });

    if (resolved.kind === "client") {
      return this.issueSession({ id: resolved.user.id, email: resolved.user.email, kind: "client" });
    }

    return this.issueSession({
      id: resolved.user.id,
      email: resolved.user.email,
      kind: "business",
      role: resolved.user.role,
    });
  }

  async forgotPassword(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const [clientUser, businessUser] = await Promise.all([
      this.prisma.userClient.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
      this.prisma.userBusiness.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
    ]);

    return {
      ok: true,
      message: "Si el correo existe, se enviaran instrucciones de recuperacion.",
      userExists: Boolean(clientUser || businessUser),
    };
  }

  verify(token: string): AuthPayload {
    const secret = this.getSecret();
    try {
      return jwt.verify(token, secret) as AuthPayload;
    } catch {
      throw new UnauthorizedException("Token invalido");
    }
  }

  private async verifyOAuthToken(token: string, providerKey: ProviderKey) {
    const provider = this.getOAuthProviderConfig(providerKey);
    const issuer = provider.issuer;
    if (!issuer) {
      throw new BadRequestException(`Falta issuer OAuth para ${providerKey}`);
    }
    const audiences = provider.audiences;
    const jwksUri = provider.jwksUri || `${issuer.replace(/\/+$/, "")}/.well-known/jwks.json`;
    const jwks = createRemoteJWKSet(new URL(jwksUri));
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: audiences.length === 1 ? audiences[0] : audiences,
    });
    return payload;
  }

  private async findOrProvisionOAuthUser(input: {
    email: string;
    name?: string;
    requestedKind?: "client" | "business";
  }): Promise<ResolvedUser> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const [clientUser, businessUser] = await Promise.all([
      this.prisma.userClient.findUnique({ where: { email: normalizedEmail } }),
      this.prisma.userBusiness.findUnique({ where: { email: normalizedEmail } }),
    ]);

    if (input.requestedKind === "client") {
      if (businessUser && !clientUser) {
        throw new UnauthorizedException("Ese correo ya pertenece a una cuenta de empresa");
      }
      if (clientUser) return { kind: "client", user: clientUser };
      return {
        kind: "client",
        user: await this.prisma.userClient.create({
          data: {
            email: normalizedEmail,
            name: input.name || null,
            password: await this.generateOauthPassword(),
          },
        }),
      };
    }

    if (input.requestedKind === "business") {
      if (clientUser && !businessUser) {
        throw new UnauthorizedException("Ese correo ya pertenece a una cuenta de cliente");
      }
      if (businessUser) return { kind: "business", user: businessUser };
      return {
        kind: "business",
        user: await this.prisma.userBusiness.create({
          data: {
            email: normalizedEmail,
            name: input.name || null,
            password: await this.generateOauthPassword(),
            role: UserRole.BUSINESS_OWNER,
          },
        }),
      };
    }

    if (clientUser && businessUser) {
      throw new UnauthorizedException("Cuenta ambigua: existe como cliente y como empresa. Debes indicar kind.");
    }
    if (clientUser) return { kind: "client", user: clientUser };
    if (businessUser) return { kind: "business", user: businessUser };

    return {
      kind: "client",
      user: await this.prisma.userClient.create({
        data: {
          email: normalizedEmail,
          name: input.name || null,
          password: await this.generateOauthPassword(),
        },
      }),
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const secret = this.getSecret();
    let payload: AuthPayload;
    try {
      const decoded = jwt.verify(refreshToken, secret) as AuthPayload & { type?: string };
      if (decoded.type !== "refresh") throw new Error("Not a refresh token");
      payload = { id: decoded.id, email: decoded.email, kind: decoded.kind, role: decoded.role };
    } catch {
      throw new UnauthorizedException("Refresh token inválido o expirado");
    }
    return this.issueSession(payload);
  }

  private issueSession(payload: AuthPayload) {
    const secret = this.getSecret();
    const accessOptions: SignOptions = { expiresIn: this.getJwtExpiresIn() as SignOptions["expiresIn"] };
    const refreshOptions: SignOptions = { expiresIn: REFRESH_TOKEN_EXPIRY as SignOptions["expiresIn"] };
    const refreshPayload = { ...payload, type: "refresh" };
    return {
      token: jwt.sign(payload, secret, accessOptions),
      refreshToken: jwt.sign(refreshPayload, secret, refreshOptions),
      user: payload,
    };
  }

  private async generateOauthPassword() {
    return hash(`oauth:${randomUUID()}`, 10);
  }

  private getSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new BadRequestException("Falta JWT_SECRET en las variables de entorno");
    }
    return secret;
  }

  private getJwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN || ACCESS_TOKEN_EXPIRY_DEFAULT;
  }

  private getRequiredEnv(key: string) {
    const value = process.env[key];
    if (!value) {
      throw new BadRequestException(`Falta ${key} en las variables de entorno`);
    }
    return value;
  }

  private getOAuthProviderConfig(providerKey: ProviderKey): OAuthProviderRuntimeConfig {
    const map: Record<ProviderKey, { issuer?: string; jwksUri?: string; audienceRaw?: string }> = {
      kazehana: {
        issuer: process.env.OAUTH_ISSUER,
        jwksUri: process.env.OAUTH_JWKS_URI,
        audienceRaw: process.env.OAUTH_ALLOWED_AUDIENCES || process.env.OAUTH_AUDIENCE || process.env.OAUTH_CLIENT_ID,
      },
      google: {
        issuer: process.env.OAUTH_GOOGLE_ISSUER || "https://accounts.google.com",
        jwksUri: process.env.OAUTH_GOOGLE_JWKS_URI,
        audienceRaw: process.env.OAUTH_GOOGLE_ALLOWED_AUDIENCES || process.env.OAUTH_GOOGLE_AUDIENCE || process.env.OAUTH_GOOGLE_CLIENT_ID,
      },
      apple: {
        issuer: process.env.OAUTH_APPLE_ISSUER || "https://appleid.apple.com",
        jwksUri: process.env.OAUTH_APPLE_JWKS_URI || "https://appleid.apple.com/auth/keys",
        audienceRaw: process.env.OAUTH_APPLE_ALLOWED_AUDIENCES || process.env.OAUTH_APPLE_AUDIENCE || process.env.OAUTH_APPLE_CLIENT_ID,
      },
      line: {
        issuer: process.env.OAUTH_LINE_ISSUER || "https://access.line.me",
        jwksUri: process.env.OAUTH_LINE_JWKS_URI || "https://api.line.me/oauth2/v2.1/certs",
        audienceRaw: process.env.OAUTH_LINE_ALLOWED_AUDIENCES || process.env.OAUTH_LINE_AUDIENCE || process.env.OAUTH_LINE_CLIENT_ID,
      },
      x: {
        issuer: process.env.OAUTH_X_ISSUER,
        jwksUri: process.env.OAUTH_X_JWKS_URI,
        audienceRaw: process.env.OAUTH_X_ALLOWED_AUDIENCES || process.env.OAUTH_X_AUDIENCE || process.env.OAUTH_X_CLIENT_ID,
      },
    };

    const cfg = map[providerKey];
    return {
      key: providerKey,
      issuer: cfg.issuer,
      jwksUri: cfg.jwksUri,
      audiences: this.parseAudiences(cfg.audienceRaw, providerKey),
    };
  }

  private parseAudiences(raw: string | undefined, providerKey: ProviderKey) {
    if (!raw) {
      throw new BadRequestException(`Falta audiencia OAuth para ${providerKey}`);
    }
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private resolveStringClaim(value: JWTPayload[keyof JWTPayload]) {
    return typeof value === "string" && value.trim().length ? value.trim() : undefined;
  }
}
