import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { compare } from "bcryptjs";
import { PrismaService } from "./prisma.service";
import { AuthPayload } from "../types/auth-user";

type LoginInput = { email: string; password: string; kind: "client" | "business" };

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(input: LoginInput) {
    try {
      const secret = this.getSecret();
      const user =
        input.kind === "client"
          ? await this.prisma.userClient.findUnique({ where: { email: input.email } })
          : await this.prisma.userBusiness.findUnique({ where: { email: input.email } });

      if (!user) throw new UnauthorizedException("Credenciales inválidas");

      const ok = await compare(input.password, user.password);
      if (!ok) throw new UnauthorizedException("Credenciales inválidas");

      const payload: AuthPayload = {
        id: user.id,
        email: user.email,
        kind: input.kind,
        role: "role" in user ? (user as any).role : undefined,
      };

      const token = jwt.sign(payload, secret, { expiresIn: "7d" });
      return { token, user: payload };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[auth] login error", err);
      if (err instanceof UnauthorizedException || err instanceof BadRequestException) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : "No se pudo iniciar sesión";
      throw new UnauthorizedException(msg);
    }
  }

  verify(token: string): AuthPayload {
    const secret = this.getSecret();
    try {
      return jwt.verify(token, secret) as AuthPayload;
    } catch {
      throw new UnauthorizedException("Token inválido");
    }
  }

  private getSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new BadRequestException("Falta JWT_SECRET en las variables de entorno");
    }
    return secret;
  }
}
