import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../services/auth.service";
import { AuthPayload } from "../types/auth-user";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Falta token Bearer");
    }
    const token = authHeader.replace("Bearer ", "").trim();
    const payload = this.auth.verify(token);
    (req as any).user = payload;
    return true;
  }
}

export type RequestWithUser = {
  user: AuthPayload;
};
