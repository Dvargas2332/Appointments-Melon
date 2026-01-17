import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.enableShutdownHooks();

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`API escuchando on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
