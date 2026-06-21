import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  CompleteOnboarding,
  completeOnboardingSchema,
} from "@/features/auth/application/use-cases/CompleteOnboarding";
import { container } from "@/server/lib/container";
import { jsonError, parseRequestBody } from "@/server/lib/apiErrors";

const completeOnboarding = new CompleteOnboarding(container.userRepository);

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Please sign in to continue." },
        { status: 401 }
      );
    }

    const user = await container.userRepository.findByEmail(session.user.email);
    if (!user) {
      return NextResponse.json(
        { error: "We couldn't find your account. Please sign in again." },
        { status: 404 }
      );
    }

    const body = (await parseRequestBody(request)) as Record<string, unknown>;
    const input = completeOnboardingSchema.parse({ ...body, userId: user.id });
    const profile = await completeOnboarding.execute(input);
    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error);
  }
}
