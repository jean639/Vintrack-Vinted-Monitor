import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
    test("landing page renders the product shell", async ({ page }) => {
        await page.goto("/");

        await expect(page).toHaveTitle(/Vintrack/i);
        await expect(
            page.getByRole("link", { name: /Vintrack/i }).first(),
        ).toBeVisible();
        await expect(
            page.getByRole("link", { name: "Launch app" }).first(),
        ).toBeVisible();
        await expect(
            page.getByRole("link", { name: "Start monitoring" }),
        ).toBeVisible();
        await expect(
            page.getByRole("link", { name: "Star on GitHub" }),
        ).toBeVisible();
    });

    test("login page renders the auth call to action", async ({ page }) => {
        await page.goto("/login");

        await expect(page).toHaveTitle(/Login/i);
        await expect(
            page.getByRole("heading", { name: /Secure access/i }),
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: /Continue with/i }),
        ).toBeVisible();
    });
});
