import bcrypt from "bcryptjs";
import { z } from "zod";
import { IUserRepository } from "../../domain/repositories/IUserRepository";
import { User } from "../../domain/entities/User";
import { UserFacingError } from "@/server/lib/errors";

export const signUpUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
});

export type SignUpUserInput = z.infer<typeof signUpUserSchema>;

export class SignUpUser {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: SignUpUserInput): Promise<User> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new UserFacingError(
        "That email is already registered — try signing in instead."
      );
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    return this.userRepository.create({
      email: input.email.toLowerCase().trim(),
      name: input.name.trim(),
      passwordHash,
    });
  }
}
