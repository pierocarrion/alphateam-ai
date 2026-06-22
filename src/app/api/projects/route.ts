import { NextResponse } from "next/server";
import { requireUser } from "@/server/lib/auth";
import { container } from "@/server/lib/container";
import { jsonError, parseRequestBody } from "@/server/lib/apiErrors";
import {
  CreateProject,
  createProjectSchema,
} from "@/features/projects/application/use-cases/CreateProject";
import { SearchProjects } from "@/features/projects/application/use-cases/SearchProjects";

const createProject = new CreateProject(container.projectRepository);
const searchProjects = new SearchProjects(container.projectRepository);

export async function GET(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const results = await searchProjects.execute(query);
    return NextResponse.json({ projects: results });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (auth.response) return auth.response;

    const body = (await parseRequestBody(request)) as Record<string, unknown>;
    const parsed = createProjectSchema.safeParse({
      ...body,
      userId: auth.user.id,
    });
    if (!parsed.success) {
      return jsonError(parsed.error);
    }

    const project = await createProject.execute(parsed.data);

    if (parsed.data.tone) {
      await container.userRepository.updateProfile(auth.user.id, {
        tone: parsed.data.tone,
      });
    }

    return NextResponse.json({ project });
  } catch (error) {
    return jsonError(error);
  }
}
