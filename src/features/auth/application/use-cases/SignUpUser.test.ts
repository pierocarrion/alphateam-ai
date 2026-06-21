import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { SignUpUser, signUpUserSchema } from "./SignUpUser";
import { PrismaUserRepository } from "../../infrastructure/repositories/PrismaUserRepository";
import { getTestPrisma } from "@/tests/helpers/db";
import { UserFacingError } from "@/server/lib/errors";

const createUseCase = () => new SignUpUser(new PrismaUserRepository());

describe("SignUpUser", () => {
  it("creates a new user with a hashed password", async () => {
    const useCase = createUseCase();
    const user = await useCase.execute({
      email: "new@example.com",
      name: "New User",
      password: "secure-password",
    });

    expect(user.email).toBe("new@example.com");
    expect(user.name).toBe("New User");

    const prisma = await getTestPrisma();
    const row = await prisma.user.findUnique({ where: { email: "new@example.com" } });
    expect(row).not.toBeNull();
    expect(await bcrypt.compare("secure-password", row!.passwordHash!)).toBe(true);
  });

  it("throws when email is already registered", async () => {
    const useCase = createUseCase();
    await useCase.execute({
      email: "dup@example.com",
      name: "First",
      password: "password123",
    });

    await expect(
      useCase.execute({
        email: "dup@example.com",
        name: "Second",
        password: "password123",
      })
    ).rejects.toThrow(/already registered/i);
  });

  it("throws a user-facing error for duplicate emails", async () => {
    const useCase = createUseCase();
    await useCase.execute({
      email: "dup2@example.com",
      name: "First",
      password: "password123",
    });

    await expect(
      useCase.execute({
        email: "dup2@example.com",
        name: "Second",
        password: "password123",
      })
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it("schema rejects short passwords", () => {
    const result = signUpUserSchema.safeParse({
      email: "test@example.com",
      name: "Test",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("schema rejects invalid emails", () => {
    const result = signUpUserSchema.safeParse({
      email: "not-an-email",
      name: "Test",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });
});
