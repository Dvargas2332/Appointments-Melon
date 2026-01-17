import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AppointmentStatus, Prisma, UserRole } from "@prisma/client";
import { DateTime } from "luxon";
import { compare, hash } from "bcryptjs";
import { PrismaService } from "./prisma.service";

type CreateBusinessInput = {
  ownerId: string;
  name: string;
  category: string;
  phone?: string;
  address?: string;
  timezone?: string;
};

type CreateServiceInput = {
  name: string;
  durationMin: number;
  priceYen: number;
  isActive?: boolean;
};

type AvailabilityRequest = {
  date: string;
  serviceId: string;
  stepMinutes?: number;
  staffId?: string;
};

type AvailabilityRuleInput = {
  dayOfWeek: number; // 0-6 (domingo = 0)
  startTime: string; // "09:00"
  endTime: string; // "18:00"
};

type AvailabilityExceptionInput = {
  date: string; // YYYY-MM-DD
  isClosed?: boolean;
  startTime?: string;
  endTime?: string;
};

type CreateAppointmentInput = {
  businessId: string;
  serviceId: string;
  startAt: string;
  staffId?: string;
  customerNote?: string;
};

type ListAppointmentsInput = {
  businessId?: string;
  customerId?: string;
  ownerId?: string;
  limit?: number;
};

type CreateClientInput = {
  name?: string | null;
  email: string;
  password: string;
  phone?: string | null;
};

type CreateBusinessUserInput = {
  name?: string | null;
  email: string;
  password: string;
  phone?: string | null;
  role?: UserRole;
};

type UpdateProfileInput = {
  name?: string | null;
  phone?: string | null;
  status?: string | null;
  avatarUrl?: string | null;
  visibility?: boolean;
  notifyApp?: boolean;
  notifyEmail?: boolean;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
};

type CreateActivityInput = {
  title: string;
  note?: string | null;
  kind: string;
  startAt: string;
  importance?: string;
};

const DEFAULT_STEP_MINUTES = 15;

@Injectable()
export class BookingService {
  constructor(private readonly prisma: PrismaService) {}

  async createClient(input: CreateClientInput) {
    const hashed = await this.hashPassword(input.password);
    try {
      return await this.prisma.userClient.create({
        data: {
          name: input.name,
          email: input.email,
          password: hashed,
          phone: input.phone,
        },
      });
    } catch (error) {
      this.rethrowPrismaConflict(error, "Cliente ya existe con el mismo email o teléfono");
      throw error;
    }
  }

  async createBusinessUser(input: CreateBusinessUserInput) {
    const hashed = await this.hashPassword(input.password);
    try {
      return await this.prisma.userBusiness.create({
        data: {
          name: input.name,
          email: input.email,
          password: hashed,
          phone: input.phone,
          role: input.role ?? UserRole.BUSINESS_OWNER,
        },
      });
    } catch (error) {
      this.rethrowPrismaConflict(error, "Usuario de negocio ya existe con el mismo email o teléfono");
      throw error;
    }
  }

  async getProfile(userId: string, kind: "client" | "business") {
    if (kind === "client") {
      return this.prisma.userClient.findUnique({ where: { id: userId } });
    }
    return this.prisma.userBusiness.findUnique({ where: { id: userId } });
  }

  async updateProfile(userId: string, kind: "client" | "business", data: UpdateProfileInput) {
    const updateCommon: Prisma.UserClientUpdateInput = {
      name: data.name ?? undefined,
      phone: data.phone ?? undefined,
      status: data.status ?? undefined,
      avatarUrl: data.avatarUrl ?? undefined,
      visibility: data.visibility ?? undefined,
      notifyApp: data.notifyApp ?? undefined,
      notifyEmail: data.notifyEmail ?? undefined,
    };

    const handlePassword = async (currentPassword?: string, newPassword?: string, record?: { password: string }) => {
      if (!newPassword) return undefined;
      if (!currentPassword || !record) throw new BadRequestException("Contraseña actual requerida");
      const ok = await compare(currentPassword, record.password);
      if (!ok) throw new BadRequestException("Contraseña actual incorrecta");
      if (newPassword.length < 6) throw new BadRequestException("Contraseña insegura");
      return hash(newPassword, 10);
    };

    if (kind === "client") {
      const existing = await this.prisma.userClient.findUnique({ where: { id: userId } });
      if (!existing) throw new NotFoundException("Cliente no encontrado");
      const newHash = await handlePassword(data.currentPassword, data.newPassword, existing);
      return this.prisma.userClient.update({
        where: { id: userId },
        data: {
          ...updateCommon,
          email: data.email ?? undefined,
          password: newHash ?? undefined,
        },
      });
    }
    const existing = await this.prisma.userBusiness.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException("Usuario negocio no encontrado");
    const newHash = await handlePassword(data.currentPassword, data.newPassword, existing);
    return this.prisma.userBusiness.update({
      where: { id: userId },
      data: {
        ...updateCommon,
        email: data.email ?? undefined,
        password: newHash ?? undefined,
      },
    });
  }

  async createActivity(userId: string, input: CreateActivityInput) {
    const start = DateTime.fromISO(input.startAt);
    if (!start.isValid) throw new BadRequestException("Fecha de actividad inválida");
    return this.prisma.activity.create({
      data: {
        userId,
        title: input.title,
        note: input.note,
        kind: input.kind,
        importance: input.importance || "medium",
        startAt: start.toJSDate(),
      },
    });
  }

  async listActivities(userId: string) {
    return this.prisma.activity.findMany({
      where: { userId },
      orderBy: { startAt: "asc" },
    });
  }

  async updateActivity(userId: string, activityId: string, input: Partial<CreateActivityInput>) {
    const activity = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity || activity.userId !== userId) throw new NotFoundException("Actividad no encontrada");
    const start = input.startAt ? DateTime.fromISO(input.startAt) : null;
    if (input.startAt && !start?.isValid) throw new BadRequestException("Fecha de actividad inválida");
    return this.prisma.activity.update({
      where: { id: activityId },
      data: {
        title: input.title ?? undefined,
        note: input.note ?? undefined,
        kind: input.kind ?? undefined,
        importance: input.importance ?? undefined,
        startAt: start ? start.toJSDate() : undefined,
      },
    });
  }

  async createBusiness(input: CreateBusinessInput) {
    const owner = await this.prisma.userBusiness.findUnique({ where: { id: input.ownerId } });
    if (!owner) throw new NotFoundException("Propietario de negocio no encontrado");
    if (owner.role !== UserRole.BUSINESS_OWNER) {
      throw new ForbiddenException("Solo un propietario puede crear negocios");
    }

    return this.prisma.business.create({
      data: {
        ownerId: input.ownerId,
        name: input.name,
        category: input.category,
        phone: input.phone,
        address: input.address,
        timezone: input.timezone || "Asia/Tokyo",
      },
    });
  }

  listBusinesses(ownerId?: string) {
    return this.prisma.business.findMany({
      where: ownerId ? { ownerId } : undefined,
      include: {
        services: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createService(businessId: string, input: CreateServiceInput, actorId?: string) {
    await this.assertBusinessAccess(businessId, actorId);
    return this.prisma.service.create({
      data: {
        businessId,
        name: input.name,
        durationMin: input.durationMin,
        priceYen: input.priceYen,
        isActive: input.isActive ?? true,
      },
    });
  }

  listServices(businessId: string) {
    return this.prisma.service.findMany({
      where: { businessId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async addAvailabilityRule(businessId: string, input: AvailabilityRuleInput, actorId?: string) {
    await this.assertBusinessAccess(businessId, actorId);
    if (input.dayOfWeek < 0 || input.dayOfWeek > 6) {
      throw new BadRequestException("dayOfWeek debe estar entre 0 (domingo) y 6 (sábado)");
    }
    this.assertValidTimeRange(input.startTime, input.endTime);

    return this.prisma.availabilityRule.create({
      data: {
        businessId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
      },
    });
  }

  listAvailabilityRules(businessId: string) {
    return this.prisma.availabilityRule.findMany({
      where: { businessId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  async addAvailabilityException(businessId: string, input: AvailabilityExceptionInput, actorId?: string) {
    const business = await this.assertBusinessAccess(businessId, actorId);

    const timezone = business.timezone || "UTC";
    const day = DateTime.fromISO(input.date, { zone: timezone }).startOf("day");
    if (!day.isValid) throw new BadRequestException("Fecha inválida");

    if (!input.isClosed) {
      if (!input.startTime || !input.endTime) {
        throw new BadRequestException("startTime y endTime son requeridos cuando isClosed es false");
      }
      this.assertValidTimeRange(input.startTime, input.endTime);
    }

    return this.prisma.availabilityException.create({
      data: {
        businessId,
        date: day.toUTC().toJSDate(),
        isClosed: input.isClosed ?? true,
        startTime: input.startTime,
        endTime: input.endTime,
      },
    });
  }

  listAvailabilityExceptions(businessId: string) {
    return this.prisma.availabilityException.findMany({
      where: { businessId },
      orderBy: { date: "asc" },
    });
  }

  async getAvailability(businessId: string, params: AvailabilityRequest) {
    const context = await this.getDailyContext(businessId, params.date);
    const service = await this.prisma.service.findUnique({ where: { id: params.serviceId } });
    if (!service) throw new NotFoundException("Servicio no encontrado");
    if (service.businessId !== businessId) {
      throw new BadRequestException("El servicio no pertenece al negocio");
    }

    const serviceDuration = service.durationMin;
    const stepMinutes = params.stepMinutes || DEFAULT_STEP_MINUTES;
    const now = DateTime.now().setZone(context.timezone);

    const slots: { startAt: string; endAt: string }[] = [];

    for (const interval of context.intervals) {
      let cursor = interval.start;
      while (cursor.plus({ minutes: serviceDuration }) <= interval.end) {
        const candidateStart = cursor;
        const candidateEnd = cursor.plus({ minutes: serviceDuration });
        const isPast = candidateStart <= now.minus({ minutes: 1 });
        const hasConflict = context.appointments.some((appt) =>
          this.overlaps(candidateStart, candidateEnd, appt.startAt, appt.endAt, context.timezone, params.staffId, appt.staffId),
        );

        if (!isPast && !hasConflict) {
          const startIso = candidateStart.toISO();
          const endIso = candidateEnd.toISO();
          if (startIso && endIso) {
            slots.push({ startAt: startIso, endAt: endIso });
          }
        }

        cursor = cursor.plus({ minutes: stepMinutes });
      }
    }

    return {
      date: context.day.toISODate() || params.date,
      timezone: context.timezone,
      serviceDurationMin: serviceDuration,
      stepMinutes,
      slots,
    };
  }

  async createAppointment(input: CreateAppointmentInput, customerId: string) {
    const [business, service, customer] = await Promise.all([
      this.prisma.business.findUnique({ where: { id: input.businessId } }),
      this.prisma.service.findUnique({ where: { id: input.serviceId } }),
      this.prisma.userClient.findUnique({ where: { id: customerId } }),
    ]);

    if (!business) throw new NotFoundException("Negocio no encontrado");
    if (!service) throw new NotFoundException("Servicio no encontrado");
    if (service.businessId !== input.businessId) {
      throw new BadRequestException("El servicio no pertenece al negocio indicado");
    }
    if (!customer) throw new NotFoundException("Cliente no encontrado");

    if (input.staffId) {
      const staff = await this.prisma.userBusiness.findUnique({ where: { id: input.staffId } });
      if (!staff) throw new NotFoundException("Staff no encontrado");
    }

    const timezone = business.timezone || "UTC";
    const start = DateTime.fromISO(input.startAt, { zone: timezone });
    if (!start.isValid) throw new BadRequestException("Fecha de inicio inválida");

    const end = start.plus({ minutes: service.durationMin });
    const context = await this.getDailyContext(input.businessId, start.toISODate()!);

    const fitsAvailability = context.intervals.some(
      (interval) => start >= interval.start && end <= interval.end,
    );
    if (!fitsAvailability) throw new BadRequestException("Horario fuera de la disponibilidad del negocio");

    const conflict = context.appointments.some((appt) =>
      this.overlaps(start, end, appt.startAt, appt.endAt, context.timezone, input.staffId, appt.staffId),
    );
    if (conflict) throw new BadRequestException("Existe otra cita en ese horario");

    const created = await this.prisma.appointment.create({
      data: {
        businessId: input.businessId,
        serviceId: input.serviceId,
        customerId,
        staffId: input.staffId,
        startAt: start.toUTC().toJSDate(),
        endAt: end.toUTC().toJSDate(),
        customerNote: input.customerNote,
        status: AppointmentStatus.BOOKED,
      },
    });

    return created;
  }

  async cancelAppointment(id: string, actor: { id: string; kind: "client" | "business" }) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundException("Cita no encontrada");
    if (appointment.status === AppointmentStatus.CANCELLED) return appointment;

    if (actor.kind === "client" && appointment.customerId !== actor.id) {
      throw new ForbiddenException("Solo el cliente que reservó puede cancelar");
    }
    if (actor.kind === "business") {
      await this.assertBusinessAccess(appointment.businessId, actor.id);
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED },
    });
  }

  async listAppointments(params: ListAppointmentsInput) {
    const where: Prisma.AppointmentWhereInput = {
      status: { not: AppointmentStatus.CANCELLED },
    };

    if (params.customerId) where.customerId = params.customerId;

    if (params.ownerId && !params.businessId) {
      throw new ForbiddenException("Debes indicar el negocio para listar como propietario");
    }

    if (params.businessId) {
      if (params.ownerId) await this.assertBusinessAccess(params.businessId, params.ownerId);
      else await this.assertBusinessExists(params.businessId);
      where.businessId = params.businessId;
    }

    return this.prisma.appointment.findMany({
      where,
      orderBy: { startAt: "asc" },
      take: params.limit ?? 50,
      include: {
        service: true,
        customer: true,
        business: true,
      },
    });
  }

  private async getDailyContext(businessId: string, date: string) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException("Negocio no encontrado");

    const timezone = business.timezone || "UTC";
    const day = DateTime.fromISO(date, { zone: timezone }).startOf("day");
    if (!day.isValid) throw new BadRequestException("Fecha inválida");

    const dayOfWeek = day.weekday === 7 ? 0 : day.weekday;

    const [rules, exception, appointments] = await Promise.all([
      this.prisma.availabilityRule.findMany({
        where: { businessId, dayOfWeek },
        orderBy: { startTime: "asc" },
      }),
      this.prisma.availabilityException.findFirst({
        where: {
          businessId,
          date: {
            gte: day.toUTC().toJSDate(),
            lt: day.plus({ days: 1 }).toUTC().toJSDate(),
          },
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          businessId,
          startAt: { gte: day.toUTC().toJSDate(), lt: day.plus({ days: 1 }).toUTC().toJSDate() },
          status: { not: AppointmentStatus.CANCELLED },
        },
        select: { startAt: true, endAt: true, staffId: true },
      }),
    ]);

    let intervals = rules
      .map((rule) => this.intervalFromStrings(day, timezone, rule.startTime, rule.endTime))
      .filter((interval): interval is { start: DateTime; end: DateTime } => !!interval);

    if (exception) {
      if (exception.isClosed) {
        intervals = [];
      } else if (exception.startTime && exception.endTime) {
        const override = this.intervalFromStrings(day, timezone, exception.startTime, exception.endTime);
        intervals = override ? [override] : [];
      }
    }

    return { business, intervals, appointments, day, timezone };
  }

  private intervalFromStrings(day: DateTime, timezone: string, startTime: string, endTime: string) {
    const [startHour, startMinute] = startTime.split(":").map((v) => Number(v));
    const [endHour, endMinute] = endTime.split(":").map((v) => Number(v));

    if (
      Number.isNaN(startHour) ||
      Number.isNaN(startMinute) ||
      Number.isNaN(endHour) ||
      Number.isNaN(endMinute)
    ) {
      return null;
    }

    const start = day.set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 }).setZone(timezone);
    const end = day.set({ hour: endHour, minute: endMinute, second: 0, millisecond: 0 }).setZone(timezone);

    if (!start.isValid || !end.isValid || end <= start) return null;

    return { start, end };
  }

  private assertValidTimeRange(startTime: string, endTime: string) {
    const fakeDay = DateTime.fromISO("2020-01-01");
    const interval = this.intervalFromStrings(fakeDay, "UTC", startTime, endTime);
    if (!interval) throw new BadRequestException("Rango de horario inválido");
  }

  private overlaps(
    start: DateTime,
    end: DateTime,
    existingStart: Date | string,
    existingEnd: Date | string,
    timezone: string,
    targetStaffId?: string,
    existingStaffId?: string | null,
  ) {
    if (targetStaffId) {
      if (existingStaffId && existingStaffId !== targetStaffId) return false;
    }

    const exStart = DateTime.fromJSDate(existingStart instanceof Date ? existingStart : new Date(existingStart)).setZone(
      timezone,
    );
    const exEnd = DateTime.fromJSDate(existingEnd instanceof Date ? existingEnd : new Date(existingEnd)).setZone(timezone);

    return start < exEnd && end > exStart;
  }

  private async assertBusinessExists(id: string) {
    const exists = await this.prisma.business.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException("Negocio no encontrado");
  }

  private async assertBusinessAccess(businessId: string, actorId?: string) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException("Negocio no encontrado");
    if (actorId && business.ownerId !== actorId) {
      throw new ForbiddenException("Solo el propietario puede modificar el negocio");
    }
    return business;
  }

  private async hashPassword(raw: string) {
    const { hash } = await import("bcryptjs");
    return hash(raw, 10);
  }

  private rethrowPrismaConflict(error: unknown, message: string) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new BadRequestException(message);
    }
  }
}
