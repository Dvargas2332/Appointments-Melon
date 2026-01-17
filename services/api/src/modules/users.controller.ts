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

const profileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  status: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  visibility: z.boolean().optional(),
  notifyApp: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).regex(/[A-Z]/, "Debe tener mayúscula").regex(/[0-9]/, "Debe tener números").optional(),
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
      return this.booking.updateProfile(req.user.id, req.user.kind, input);
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
