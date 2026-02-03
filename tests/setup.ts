import { vi } from "vitest";

vi.mock("@utilities/ApiClient", () => ({
  RequestJson: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      joke: "Test joke",
      type: "single",
      articles: [],
    },
  }),
}));
