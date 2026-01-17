import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards, Req } from "@nestjs/common";
import { z } from "zod";
import { BookingService } from "../services/booking.service";
import { AuthGuard, RequestWithUser } from "./auth.guard";

const createAppointmentSchema = z.object({
  businessId: z.string().min(1),
  serviceId: z.string().min(1),
  startAt: z.string().min(1, "startAt debe ser ISO-8601"),
  staffId: z.string().optional(),
  customerNote: z.string().optional(),
});

const listAppointmentsSchema = z.object({
  businessId: z.string().optional(),
  customerId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly booking: BookingService) {}

  @Post()
  @UseGuards(AuthGuard)
  create(@Req() req: RequestWithUser, @Body() body: unknown) {
    if (req.user.kind !== "client") throw new ForbiddenException("Solo clientes pueden agendar");
    const input = createAppointmentSchema.parse(body);
    return this.booking.createAppointment(input, req.user.id);
  }

  @Get()
  @UseGuards(AuthGuard)
  list(@Req() req: RequestWithUser, @Query() query: unknown) {
    const params = listAppointmentsSchema.parse(query);
    if (req.user.kind === "client") {
      return this.booking.listAppointments({ ...params, customerId: req.user.id });
    }
    if (!params.businessId) {
      throw new ForbiddenException("Debe indicar businessId para listar como negocio");
    }
    return this.booking.listAppointments({ ...params, ownerId: req.user.id });
  }

  @Post(":id/cancel")
  @UseGuards(AuthGuard)
  cancel(@Req() req: RequestWithUser, @Param("id") id: string) {
    return this.booking.cancelAppointment(id, req.user);
  }
}
