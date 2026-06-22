import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OnboardingFlow } from "./OnboardingFlow";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

describe("OnboardingFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("advances through all four steps and submits", async () => {
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ profile: { onboarded: true } }),
    } as Response);

    render(<OnboardingFlow />);

    // Step 1: select role
    expect(screen.getByText("Nice to meet you.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("I build / make"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 2: select hard moment
    await screen.findByText("When is starting hardest?");
    fireEvent.click(screen.getByText("Mornings — facing the day"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 3: select profile
    await screen.findByText("What pulls you off the most?");
    fireEvent.click(screen.getByText("Too many things — I freeze"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 4: summary
    await screen.findByText("Take me in");
    fireEvent.click(screen.getByRole("button", { name: /take me in/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/onboarding",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            role: "I build / make",
            hardMoment: "morning",
            profileId: "multi",
            tone: "warm",
          }),
        })
      );
    });

    expect(push).toHaveBeenCalledWith("/setup/join");
  });

  it("disables continue until an option is selected", () => {
    render(<OnboardingFlow />);
    const continueButton = screen.getByRole("button", { name: /continue/i });
    expect(continueButton).toBeDisabled();

    fireEvent.click(screen.getByText("I build / make"));
    expect(continueButton).not.toBeDisabled();
  });

  it("routes a leader to the project setup", async () => {
    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ profile: { onboarded: true } }),
    } as Response);

    render(<OnboardingFlow />);

    fireEvent.click(screen.getByText("I lead a team"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await screen.findByText("When is starting hardest?");
    fireEvent.click(screen.getByText("Mornings — facing the day"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await screen.findByText("What pulls you off the most?");
    fireEvent.click(screen.getByText("Too many things — I freeze"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await screen.findByText("Take me in");
    fireEvent.click(screen.getByRole("button", { name: /take me in/i }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/setup/project");
    });
  });
});
