import { expect, test } from "@playwright/test";

test.describe("dashboard feed", () => {
    test.skip(
        process.env.E2E_TEST_MODE !== "true",
        "dashboard feed e2e requires E2E_TEST_MODE and seeded database",
    );

    test("renders seeded mock Vinted items with listing metadata", async ({
        page,
    }) => {
        await page.goto("/feed");

        await expect(page).toHaveTitle(/Vintrack/i);
        await expect(
            page.getByRole("heading", { name: "Live Feed" }),
        ).toBeVisible();
        await expect(page.getByText("Live · 1 monitor")).toBeVisible();

        const nikeCard = page
            .getByTestId("item-card")
            .filter({ hasText: "E2E Nike Dunk Low Retro" })
            .first();

        await expect(nikeCard).toBeVisible();
        await expect(nikeCard.getByText("Nike", { exact: true })).toBeVisible();
        await expect(nikeCard.getByText("42", { exact: true })).toBeVisible();
        await expect(nikeCard.getByText("🇩🇪 DE")).toBeVisible();
        await expect(nikeCard.getByText("⭐ 4.9 (58)")).toBeVisible();
        await expect(nikeCard.getByText("19.00 EUR")).toBeVisible();
        await expect(nikeCard.getByText("24.49 EUR total")).toBeVisible();
        await expect(nikeCard.getByText("E2E Mock Feed")).toBeVisible();

        await expect(
            nikeCard.locator('img[src="/mock-images/vinted-1.svg"]').first(),
        ).toBeVisible();
    });

    test("opens and closes the item image preview", async ({ page }) => {
        await page.goto("/feed");

        const nikeCard = page
            .getByTestId("item-card")
            .filter({ hasText: "E2E Nike Dunk Low Retro" })
            .first();

        await nikeCard.locator('img[src="/mock-images/vinted-1.svg"]').click();

        const preview = page.locator('img[alt="Preview"]');
        await expect(preview).toBeVisible();
        await expect(preview).toHaveAttribute("src", "/mock-images/vinted-1.svg");

        await page.keyboard.press("Escape");
        await expect(preview).toBeHidden();
    });
});
