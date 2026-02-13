import { BadRequestException, Body, Controller, Get, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z, ZodError } from "zod";
import { BookingService } from "../services/booking.service";
import { AuthGuard, RequestWithUser } from "./auth.guard";

const clientSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email(),
  password: z.string().min(4),
  phone: z.string().optional(),
});

const businessUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email(),
  password: z.string().min(4),
  phone: z.string().optional(),
  role: z.enum(["BUSINESS_OWNER", "STAFF"]).default("BUSINESS_OWNER"),
});

const emptyToNull = (value: unknown) => (value === "" ? null : value);
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const profileSchema = z.object({
  name: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  phone: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  status: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  avatarUrl: z.preprocess(emptyToNull, z.string().url().nullable().optional()),
  visibility: z.boolean().optional(),
  notifyApp: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  email: z.preprocess(emptyToUndefined, z.string().email().optional()),
  currentPassword: z.preprocess(emptyToUndefined, z.string().optional()),
  newPassword: z
    .preprocess(
      emptyToUndefined,
      z.string().min(6).regex(/[A-Z]/, "Debe tener mayúscula").regex(/[0-9]/, "Debe tener números").optional(),
    ),
  nombre: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  telefono: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  estado: z.preprocess(emptyToNull, z.string().min(1).nullable().optional()),
  avatar: z.preprocess(emptyToNull, z.string().url().nullable().optional()),
  avatar_url: z.preprocess(emptyToNull, z.string().url().nullable().optional()),
  correo: z.preprocess(emptyToUndefined, z.string().email().optional()),
  passwordActual: z.preprocess(emptyToUndefined, z.string().optional()),
  contrasenaActual: z.preprocess(emptyToUndefined, z.string().optional()),
  passwordNueva: z.preprocess(emptyToUndefined, z.string().optional()),
  contrasenaNueva: z.preprocess(emptyToUndefined, z.string().optional()),
  password: z.preprocess(emptyToUndefined, z.string().optional()),
});

const activitySchema = z.object({
  title: z.string().min(1),
  note: z.string().optional(),
  kind: z.string().min(1),
  startAt: z.string().min(1),
  importance: z.string().optional(),
});

@Controller("users")
export class UsersController {
  constructor(private readonly booking: BookingService) {}

  @Post("client")
  createClient(@Body() body: unknown) {
    try {
      const input = clientSchema.parse(body);
      return this.booking.createClient(input);
    } catch (err) {
      if (err instanceof ZodError) throw new BadRequestException(err.issues);
      throw err;
    }
  }

  @Post("business")
  createBusinessUser(@Body() body: unknown) {
    try {
      const input = businessUserSchema.parse(body);
      return this.booking.createBusinessUser(input);
    } catch (err) {
      if (err instanceof ZodError) throw new BadRequestException(err.issues);
      throw err;
    }
  }

  @UseGuards(AuthGuard)
  @Get("me")
  getProfile(@Req() req: RequestWithUser) {
    return this.booking.getProfile(req.user.id, req.user.kind);
  }

  @UseGuards(AuthGuard)
  @Patch("me")
  updateProfile(@Req() req: RequestWithUser, @Body() body: unknown) {
    try {
      const input = profileSchema.parse(body);
      const normalized = {
        name: input.name ?? input.nombre,
        phone: input.phone ?? input.telefono,
        status: input.status ?? input.estado,
        avatarUrl: input.avatarUrl ?? input.avatar ?? input.avatar_url,
        visibility: input.visibility,
        notifyApp: input.notifyApp,
        notifyEmail: input.notifyEmail,
        email: input.email ?? input.correo,
        currentPassword: input.currentPassword ?? input.passwordActual ?? input.contrasenaActual,
        newPassword: input.newPassword ?? input.passwordNueva ?? input.contrasenaNueva ?? input.password,
      };
      return this.booking.updateProfile(req.user.id, req.user.kind, normalized);
    } catch (err) {
      if (err instanceof ZodError) throw new BadRequestException(err.issues);
      throw err;
    }
  }

  @UseGuards(AuthGuard)
  @Post("activities")
  createActivity(@Req() req: RequestWithUser, @Body() body: unknown) {
    if (req.user.kind !== "client") throw new BadRequestException("Solo clientes pueden crear actividades");
    try {
      const input = activitySchema.parse(body);
      return this.booking.createActivity(req.user.id, input);
    } catch (err) {
      if (err instanceof ZodError) throw new BadRequestException(err.issues);
      throw err;
    }
  }

  @UseGuards(AuthGuard)
  @Get("activities")
  listActivities(@Req() req: RequestWithUser) {
    if (req.user.kind !== "client") throw new BadRequestException("Solo clientes pueden ver actividades");
    return this.booking.listActivities(req.user.id);
  }

  @UseGuards(AuthGuard)
  @Patch("activities/:id")
  updateActivity(@Req() req: RequestWithUser & { params: { id: string } }, @Body() body: unknown) {
    if (req.user.kind !== "client") throw new BadRequestException("Solo clientes pueden editar actividades");
    try {
      const input = activitySchema.partial().parse(body);
      const activityId = req.params?.id;
      if (!activityId) throw new BadRequestException("Falta id de actividad");
      return this.booking.updateActivity(req.user.id, activityId, input);
    } catch (err) {
      if (err instanceof ZodError) throw new BadRequestException(err.issues);
      throw err;
    }
  }
}
