import { Body, Controller, Post, BadRequestException } from "@nestjs/common";
import { z, ZodError } from "zod";
import { AuthService } from "../services/auth.service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  kind: z.enum(["client", "business"]),
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
}
