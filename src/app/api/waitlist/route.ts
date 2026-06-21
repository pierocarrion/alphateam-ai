import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { jsonError, toFriendlyMessage } from "@/server/lib/apiErrors";

const bodySchema = z.object({
  email: z.string().email(),
  role: z.string().min(1),
  teamSize: z.string().min(1),
});

const WAITLIST_FILE = path.join(process.cwd(), "data", "waitlist.json");

async function readWaitlist(): Promise<Array<Record<string, unknown>>> {
  try {
    const raw = await fs.readFile(WAITLIST_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Please send a valid request." },
        { status: 400 }
      );
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: toFriendlyMessage(parsed.error) },
        { status: 400 }
      );
    }

    const { email, role, teamSize } = parsed.data;

    await fs.mkdir(path.dirname(WAITLIST_FILE), { recursive: true });
    const list = await readWaitlist();

    if (list.some((entry) => entry.email === email)) {
      return NextResponse.json(
        { error: "You're already on the list — we'll be in touch soon." },
        { status: 409 }
      );
    }

    list.push({
      email,
      role,
      teamSize,
      joinedAt: new Date().toISOString(),
    });

    await fs.writeFile(WAITLIST_FILE, JSON.stringify(list, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET() {
  try {
    const list = await readWaitlist();
    return NextResponse.json({ count: list.length, list });
  } catch (error) {
    return jsonError(error);
  }
}
