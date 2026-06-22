import { describe, expect, it, beforeEach } from "vitest";
import { PATCH } from "./route";
import { seedUser, resetDatabase, getTestPrisma } from "@/tests/helpers/db";
import { mockSession } from "@/tests/helpers/auth";
import { callRouteHandler, createJsonRequest } from "@/tests/helpers/fetch";
import { CreateProject } from "@/features/projects/application/use-cases/CreateProject";
import { RequestToJoin } from "@/features/projects/application/use-cases/RequestToJoin";
import { PrismaProjectRepository } from "@/features/projects/infrastructure/repositories/PrismaProjectRepository";

const repo = new PrismaProjectRepository();
const createProject = new CreateProject(repo);
const requestToJoin = new RequestToJoin(repo);

async function seedScenario() {
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
  const request = await requestToJoin.execute({
    userId: collaborator.id,
    hashtag: "#plataforma",
    message: "Quiero sumar",
  });

  return { leader, collaborator, project, request };
}

describe("PATCH /api/projects/requests/[id]", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("approves a request and creates a member membership", async () => {
    const { leader, collaborator, project, request } = await seedScenario();
    await mockSession(leader);

    const response = await callRouteHandler(
      PATCH,
      createJsonRequest(
        `http://localhost:3000/api/projects/requests/${request.id}`,
        "PATCH",
        { decision: "approved" }
      ),
      { id: request.id }
    );

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.request.status).toBe("approved");

    const prisma = await getTestPrisma();
    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: collaborator.id,
          workspaceId: project.id,
        },
      },
    });
    expect(membership?.role).toBe("member");
  });

  it("rejects a request without creating a membership", async () => {
    const { leader, collaborator, project, request } = await seedScenario();
    await mockSession(leader);

    const response = await callRouteHandler(
      PATCH,
      createJsonRequest(
        `http://localhost:3000/api/projects/requests/${request.id}`,
        "PATCH",
        { decision: "rejected" }
      ),
      { id: request.id }
    );
    expect(response.status).toBe(200);

    const prisma = await getTestPrisma();
    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: collaborator.id,
          workspaceId: project.id,
        },
      },
    });
    expect(membership).toBeNull();
  });

  it("forbids a non-leader from approving", async () => {
    const { collaborator, request } = await seedScenario();
    await mockSession(collaborator);

    const response = await callRouteHandler(
      PATCH,
      createJsonRequest(
        `http://localhost:3000/api/projects/requests/${request.id}`,
        "PATCH",
        { decision: "approved" }
      ),
      { id: request.id }
    );
    expect(response.status).toBe(403);
  });
});
