import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module";

const bodyParser = require("body-parser");

function buildCorsOptions() {
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    // Development: allow all origins
    return { origin: true, credentials: true };
  }

  // Production: only listed origins are accepted
  const raw = process.env.CORS_ORIGINS ?? "";
  const allowed = raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (allowed.length === 0) {
    throw new Error(
      "CORS_ORIGINS must be set in production (comma-separated list of allowed origins)"
    );
  }

  return {
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void
    ) => {
      // Allow server-to-server requests (no Origin header) and listed origins
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin '${origin}' is not allowed`));
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors(buildCorsOptions());
  app.enableShutdownHooks();
  app.use(bodyParser.json({ limit: "10mb" }));
  app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, "0.0.0.0");

  console.log(`API running on port ${port} [${process.env.NODE_ENV ?? "development"}]`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
