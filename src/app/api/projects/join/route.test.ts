import { describe, expect, it, beforeEach } from "vitest";
import { POST } from "./route";
import { seedUser, resetDatabase, getTestPrisma } from "@/tests/helpers/db";
import { mockSession } from "@/tests/helpers/auth";
import { createJsonRequest } from "@/tests/helpers/fetch";
import { CreateProject } from "@/features/projects/application/use-cases/CreateProject";
import { PrismaProjectRepository } from "@/features/projects/infrastructure/repositories/PrismaProjectRepository";

const createProject = new CreateProject(new PrismaProjectRepository());

describe("POST /api/projects/join", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates a pending join request for a real project", async () => {
    const { user: leader } = await seedUser({
      name: "Leader",
      email: "leader@example.com",
    });
    const project = await createProject.execute({
      userId: leader.id,
      name: "Plataforma",
      hashtag: "#plataforma",
    });

    const { user: collaborator } = await seedUser({
      name: "Colab",
      email: "colab@example.com",
    });
    await mockSession(collaborator);

    const request = createJsonRequest(
      "http://localhost:3000/api/projects/join",
      "POST",
      { hashtag: "#plataforma", message: "Hola, quiero unirme" }
    );

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.request.status).toBe("pending");
    expect(data.request.workspaceId).toBe(project.id);
  });

  it("rejects a second request when one is already pending", async () => {
    const { user: leader } = await seedUser({
      name: "Leader",
      email: "leader2@example.com",
    });
    await createProject.execute({
      userId: leader.id,
      name: "Plataforma",
      hashtag: "#dup-req",
    });

    const { user: collaborator } = await seedUser({
      name: "Colab",
      email: "colab2@example.com",
    });
    await mockSession(collaborator);

    const first = await POST(
      createJsonRequest("http://localhost:3000/api/projects/join", "POST", {
        hashtag: "#dup-req",
      })
    );
    expect(first.status).toBe(200);

    await mockSession(collaborator);
    const second = await POST(
      createJsonRequest("http://localhost:3000/api/projects/join", "POST", {
        hashtag: "#dup-req",
      })
    );
    expect(second.status).toBe(409);
  });

  it("returns 404 when the project does not exist", async () => {
    const { user: collaborator } = await seedUser({
      name: "Colab",
      email: "colab3@example.com",
    });
    await mockSession(collaborator);

    const request = createJsonRequest(
      "http://localhost:3000/api/projects/join",
      "POST",
      { hashtag: "#inventado" }
    );
    const response = await POST(request);
    expect(response.status).toBe(404);

    const prisma = await getTestPrisma();
    const count = await prisma.joinRequest.count();
    expect(count).toBe(0);
  });
});
