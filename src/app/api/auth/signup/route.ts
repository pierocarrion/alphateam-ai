import { NextResponse } from "next/server";
import {
  SignUpUser,
  signUpUserSchema,
} from "@/features/auth/application/use-cases/SignUpUser";
import { container } from "@/server/lib/container";
import { jsonError, parseRequestBody } from "@/server/lib/apiErrors";

const signUpUser = new SignUpUser(container.userRepository);

export async function POST(request: Request) {
  try {
    const body = await parseRequestBody(request);
    const input = signUpUserSchema.parse(body);
    const user = await signUpUser.execute(input);
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    return jsonError(error);
  }
}
