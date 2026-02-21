import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
    test("should display the landing page", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveTitle(/SaaS/i);
    });

    test("should have login link", async ({ page }) => {
        await page.goto("/");
        const loginLink = page.getByRole("link", { name: /iniciar sesión|login/i });
        await expect(loginLink).toBeVisible();
    });
});

test.describe("Auth Pages", () => {
    test("login page loads", async ({ page }) => {
        await page.goto("/login");
        await expect(page.getByText(/bienvenido/i)).toBeVisible();
    });

    test("register page loads", async ({ page }) => {
        await page.goto("/register");
        await expect(page.getByText(/crear cuenta/i)).toBeVisible();
    });
});
