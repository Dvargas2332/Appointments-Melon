import { Module } from "@nestjs/common";
import { AppointmentsController } from "./appointments.controller";
import { AuthController } from "./auth.controller";
import { BusinessController } from "./business.controller";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma.module";
import { UsersController } from "./users.controller";
import { BookingService } from "../services/booking.service";
import { AuthService } from "../services/auth.service";

@Module({
  imports: [PrismaModule],
  controllers: [HealthController, UsersController, BusinessController, AppointmentsController, AuthController],
  providers: [BookingService, AuthService],
})
export class AppModule {}
