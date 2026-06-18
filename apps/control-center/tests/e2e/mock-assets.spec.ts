import { expect, test } from "@playwright/test";

test.describe("mock assets", () => {
    test("mock Vinted images are served from public assets", async ({
        request,
    }) => {
        const response = await request.get("/mock-images/vinted-1.svg");

        expect(response.ok()).toBe(true);
        expect(response.headers()["content-type"]).toContain("image/svg+xml");
        await expect(response.text()).resolves.toContain("MOCK DROP");
    });
});
