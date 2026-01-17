import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards, Req } from "@nestjs/common";
import { z } from "zod";
import { BookingService } from "../services/booking.service";
import { AuthGuard, RequestWithUser } from "./auth.guard";

const createBusinessSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  timezone: z.string().optional(),
});

const createServiceSchema = z.object({
  name: z.string().min(1),
  durationMin: z.number().int().positive(),
  priceYen: z.number().int().nonnegative(),
  isActive: z.boolean().optional(),
});

const availabilitySchema = z.object({
  date: z.string().min(1, "Debe enviar la fecha YYYY-MM-DD"),
  serviceId: z.string().min(1),
  stepMinutes: z.coerce.number().int().positive().optional(),
  staffId: z.string().optional(),
});

const availabilityRuleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});

const availabilityExceptionSchema = z.object({
  date: z.string().min(1, "YYYY-MM-DD"),
  isClosed: z.coerce.boolean().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

@Controller("businesses")
export class BusinessController {
  constructor(private readonly booking: BookingService) {}

  @Get()
  list() {
    return this.booking.listBusinesses();
  }

  @Get("mine")
  @UseGuards(AuthGuard)
  listMine(@Req() req: RequestWithUser) {
    if (req.user.kind !== "business") {
      throw new ForbiddenException("Solo usuarios de negocio");
    }
    return this.booking.listBusinesses(req.user.id);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@Req() req: RequestWithUser, @Body() body: unknown) {
    if (req.user.kind !== "business") {
      throw new ForbiddenException("Solo usuarios de negocio pueden crear negocios");
    }
    const input = createBusinessSchema.parse(body);
    return this.booking.createBusiness({ ...input, ownerId: req.user.id });
  }

  @Post(":businessId/services")
  @UseGuards(AuthGuard)
  createService(@Param("businessId") businessId: string, @Req() req: RequestWithUser, @Body() body: unknown) {
    if (req.user.kind !== "business") throw new ForbiddenException("Solo usuarios de negocio");
    const input = createServiceSchema.parse(body);
    return this.booking.createService(businessId, input, req.user.id);
  }

  @Get(":businessId/services")
  listServices(@Param("businessId") businessId: string) {
    return this.booking.listServices(businessId);
  }

  @Post(":businessId/rules")
  @UseGuards(AuthGuard)
  addRule(@Param("businessId") businessId: string, @Req() req: RequestWithUser, @Body() body: unknown) {
    if (req.user.kind !== "business") throw new ForbiddenException("Solo usuarios de negocio");
    const input = availabilityRuleSchema.parse(body);
    return this.booking.addAvailabilityRule(businessId, input, req.user.id);
  }

  @Get(":businessId/rules")
  listRules(@Param("businessId") businessId: string) {
    return this.booking.listAvailabilityRules(businessId);
  }

  @Post(":businessId/exceptions")
  @UseGuards(AuthGuard)
  addException(@Param("businessId") businessId: string, @Req() req: RequestWithUser, @Body() body: unknown) {
    if (req.user.kind !== "business") throw new ForbiddenException("Solo usuarios de negocio");
    const input = availabilityExceptionSchema.parse(body);
    return this.booking.addAvailabilityException(businessId, input, req.user.id);
  }

  @Get(":businessId/exceptions")
  listExceptions(@Param("businessId") businessId: string) {
    return this.booking.listAvailabilityExceptions(businessId);
  }

  @Get(":businessId/availability")
  getAvailability(@Param("businessId") businessId: string, @Query() query: unknown) {
    const params = availabilitySchema.parse(query);
    return this.booking.getAvailability(businessId, params);
  }
}
