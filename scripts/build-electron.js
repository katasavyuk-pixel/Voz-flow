/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const apiDir = path.join(projectRoot, "src", "app", "api");
const apiBackupDir = path.join(projectRoot, "src", "app", "_api");

console.log("🚀 Starting Electron Build Process...");

// 0. Cleanup old builds
console.log("🧹 Cleaning up old build artifacts...");
const dirsToClean = [".next", "out", "dist"];
dirsToClean.forEach((dir) => {
  const fullPath = path.join(projectRoot, dir);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
});

try {
  const isWin = process.platform === "win32";
  const moveCmd = isWin ? "move" : "mv";

  // 1. Rename api to _api to ignore it during static build
  if (fs.existsSync(apiDir)) {
    console.log("📦 Hiding API routes for static export...");
    try {
      execSync(`${moveCmd} "${apiDir}" "${apiBackupDir}"`, {
        stdio: "inherit",
      });
    } catch {
      console.log("⚠️ Shell move failed, falling back to fs.renameSync...");
      try {
        fs.renameSync(apiDir, apiBackupDir);
      } catch (err) {
        console.error("CRITICAL: Rename failed", err.message);
      }
    }
  }

  // 2. Run next build
  console.log("🏗️ Running next build...");
  execSync("npx next build", { stdio: "inherit" });

  // 3. Rename back
  if (fs.existsSync(apiBackupDir)) {
    console.log("✅ Restoring API routes...");
    try {
      execSync(`${moveCmd} "${apiBackupDir}" "${apiDir}"`, {
        stdio: "inherit",
      });
    } catch {
      try {
        fs.renameSync(apiBackupDir, apiDir);
      } catch (err) {
        console.error("CRITICAL: Restore failed", err.message);
      }
    }
  }

  // 4. Run electron-builder
  console.log("📦 Packaging Electron app...");
  execSync("npx electron-builder", { stdio: "inherit" });

  console.log("✨ Build successful! Check the /dist folder.");
} catch (error) {
  console.error("❌ Build failed:", error.message);

  // Safety: ensure API dir is restored even if build fails
  if (fs.existsSync(apiBackupDir)) {
    console.log("⚠️ Recovering API routes after failure...");
    fs.renameSync(apiBackupDir, apiDir);
  }
  process.exit(1);
}
