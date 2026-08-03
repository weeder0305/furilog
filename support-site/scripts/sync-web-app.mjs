import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "..");
const sourceDirectory = resolve(projectDirectory, "..", "app", "dist-web");
const targetDirectory = resolve(projectDirectory, "public", "app");

for (const required of ["index.html", "run/index.html", "sw.js"]) {
  await access(resolve(sourceDirectory, required));
}

if (!targetDirectory.startsWith(`${projectDirectory}\\public\\`)) {
  throw new Error("Refusing to replace a directory outside support-site/public.");
}

await rm(targetDirectory, { recursive: true, force: true });
await mkdir(targetDirectory, { recursive: true });
await cp(sourceDirectory, targetDirectory, { recursive: true });

for (const required of ["index.html", "run/index.html", "sw.js"]) {
  await access(resolve(targetDirectory, required));
}

console.log("Synchronized the current Web app into support-site/public/app.");
