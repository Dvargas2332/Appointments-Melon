// jose is ESM-only; mock it so ts-jest can load the module
jest.mock("jose", () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import { UnauthorizedException, BadRequestException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { PrismaService } from "./prisma.service";
import * as bcryptjs from "bcryptjs";

// Minimal PrismaService mock
const makePrisma = (overrides: Partial<PrismaService> = {}): PrismaService =>
  ({
    userClient: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    userBusiness: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    ...overrides,
  } as unknown as PrismaService);

const JWT_SECRET = "test_secret_for_jest";

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_EXPIRES_IN = "1h";
});

describe("AuthService.login", () => {
  it("returns token + refreshToken for valid client credentials", async () => {
    const hashedPassword = await bcryptjs.hash("password123", 10);
    const prisma = makePrisma();
    (prisma.userClient.findUnique as jest.Mock).mockResolvedValue({
      id: "client-1",
      email: "test@melon.com",
      password: hashedPassword,
    });

    const service = new AuthService(prisma);
    const result = await service.login({ email: "test@melon.com", password: "password123", kind: "client" });

    expect(result.token).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.kind).toBe("client");
    expect(result.user.email).toBe("test@melon.com");
  });

  it("throws UnauthorizedException for wrong password", async () => {
    const hashedPassword = await bcryptjs.hash("correctpassword", 10);
    const prisma = makePrisma();
    (prisma.userClient.findUnique as jest.Mock).mockResolvedValue({
      id: "client-1",
      email: "test@melon.com",
      password: hashedPassword,
    });

    const service = new AuthService(prisma);
    await expect(
      service.login({ email: "test@melon.com", password: "wrongpassword", kind: "client" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when user not found", async () => {
    const prisma = makePrisma();
    (prisma.userClient.findUnique as jest.Mock).mockResolvedValue(null);

    const service = new AuthService(prisma);
    await expect(
      service.login({ email: "notfound@melon.com", password: "any", kind: "client" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("returns token for valid business credentials", async () => {
    const hashedPassword = await bcryptjs.hash("bizpass", 10);
    const prisma = makePrisma();
    (prisma.userBusiness.findUnique as jest.Mock).mockResolvedValue({
      id: "biz-1",
      email: "owner@melon.com",
      password: hashedPassword,
      role: "BUSINESS_OWNER",
    });

    const service = new AuthService(prisma);
    const result = await service.login({ email: "owner@melon.com", password: "bizpass", kind: "business" });

    expect(result.token).toBeDefined();
    expect(result.user.kind).toBe("business");
  });
});

describe("AuthService.verify", () => {
  it("verifies a valid token", async () => {
    const hashedPassword = await bcryptjs.hash("pass", 10);
    const prisma = makePrisma();
    (prisma.userClient.findUnique as jest.Mock).mockResolvedValue({
      id: "c-1",
      email: "u@melon.com",
      password: hashedPassword,
    });

    const service = new AuthService(prisma);
    const { token } = await service.login({ email: "u@melon.com", password: "pass", kind: "client" });
    const payload = service.verify(token);

    expect(payload.id).toBe("c-1");
    expect(payload.kind).toBe("client");
  });

  it("throws UnauthorizedException for invalid token", () => {
    const service = new AuthService(makePrisma());
    expect(() => service.verify("not.a.token")).toThrow(UnauthorizedException);
  });
});

describe("AuthService.refreshAccessToken", () => {
  it("returns new tokens from a valid refresh token", async () => {
    const hashedPassword = await bcryptjs.hash("pass", 10);
    const prisma = makePrisma();
    (prisma.userClient.findUnique as jest.Mock).mockResolvedValue({
      id: "c-1",
      email: "u@melon.com",
      password: hashedPassword,
    });

    const service = new AuthService(prisma);
    const initial = await service.login({ email: "u@melon.com", password: "pass", kind: "client" });
    const refreshed = await service.refreshAccessToken(initial.refreshToken);

    expect(refreshed.token).toBeDefined();
    expect(refreshed.refreshToken).toBeDefined();
    expect(refreshed.user.kind).toBe("client");
  });

  it("throws UnauthorizedException for an access token used as refresh token", async () => {
    const hashedPassword = await bcryptjs.hash("pass", 10);
    const prisma = makePrisma();
    (prisma.userClient.findUnique as jest.Mock).mockResolvedValue({
      id: "c-1",
      email: "u@melon.com",
      password: hashedPassword,
    });

    const service = new AuthService(prisma);
    const { token } = await service.login({ email: "u@melon.com", password: "pass", kind: "client" });

    await expect(service.refreshAccessToken(token)).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException for a garbage string", async () => {
    const service = new AuthService(makePrisma());
    await expect(service.refreshAccessToken("garbage")).rejects.toThrow(UnauthorizedException);
  });
});

describe("AuthService.forgotPassword", () => {
  it("returns ok:true regardless of whether email exists", async () => {
    const prisma = makePrisma();
    (prisma.userClient.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.userBusiness.findUnique as jest.Mock).mockResolvedValue(null);

    const service = new AuthService(prisma);
    const result = await service.forgotPassword("noone@melon.com");

    expect(result.ok).toBe(true);
    expect(typeof result.message).toBe("string");
  });
});
