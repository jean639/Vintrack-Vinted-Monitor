import { expect, test } from "@playwright/test";

test.describe("first monitor onboarding", () => {
    test("dismisses, reopens, creates a preset monitor, and keeps presets in Create", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/dashboard");

        const quickStart = page.getByTestId("first-monitor-quick-start");
        await expect(quickStart).toBeVisible();
        await expect(
            quickStart.getByRole("heading", {
                name: "Start your first monitor",
            }),
        ).toBeVisible();
        await expect(
            quickStart.getByRole("combobox", { name: "Quick start region" }),
        ).toHaveValue("de");

        const dismissalResponse = page.waitForResponse(
            (response) =>
                response.request().method() === "POST" &&
                response.url().includes("/dashboard"),
        );
        await quickStart.getByRole("button", { name: "Close" }).click();
        await dismissalResponse;
        await expect(quickStart).toBeHidden();

        await page.reload();
        await expect(quickStart).toBeHidden();
        await expect(
            page.getByRole("button", { name: "Quick start" }),
        ).toBeVisible();

        await page.setViewportSize({ width: 1280, height: 900 });
        await page.getByRole("button", { name: "Quick start" }).click();
        await quickStart.getByTestId("monitor-preset-nike-dunk-low").click();
        await expect(
            quickStart.getByTestId("start-preset-monitor"),
        ).toContainText("Start Nike Dunk Low");
        await quickStart.getByTestId("start-preset-monitor").click();

        await expect(page).toHaveURL(/\/monitors\/\d+$/);
        await expect(
            page.getByRole("heading", { name: "Nike Dunk Low" }),
        ).toBeVisible();
        await expect(page.getByText("Keywords: Dunk Low")).toBeVisible();
        await expect(page.getByText("Free Proxy Pool")).toBeVisible();
        const demoLease = page.getByTestId("demo-monitor-lease");
        await expect(demoLease).toBeVisible();
        await expect(demoLease.getByText("Demo monitor")).toBeVisible();
        await expect(
            demoLease.getByRole("button", { name: "+30 min" }),
        ).toBeVisible();
        await demoLease.getByRole("button", { name: "Keep running" }).click();
        await expect(demoLease).toBeHidden();
        await page.reload();
        await expect(page.getByTestId("demo-monitor-lease")).toBeHidden();

        await page.goto("/monitors/new");
        await page.getByTestId("monitor-preset-adidas-samba").click();
        await expect(page.getByLabel("Monitor Name")).toHaveValue(
            "Adidas Samba",
        );
        await expect(
            page.getByRole("textbox", {
                name: "Keywords (optional)",
                exact: true,
            }),
        ).toHaveValue("Samba");
        await expect(page.locator('input[name="brand_ids"]')).toHaveValue("14");
    });
});
