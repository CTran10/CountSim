import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const workspaceRoot = path.resolve(desktopRoot, "../..");
const webRoot = path.join(workspaceRoot, "apps/web");
const standaloneRoot = path.join(webRoot, ".next/standalone");
const stageRoot = path.join(desktopRoot, "staged-web");

async function exists(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(standaloneRoot))) {
  throw new Error("Build the web app before staging the desktop runtime.");
}

await rm(stageRoot, { recursive: true, force: true });
await cp(standaloneRoot, stageRoot, {
  dereference: true,
  recursive: true
});

const serverRoot = (await exists(path.join(stageRoot, "server.js")))
  ? stageRoot
  : path.join(stageRoot, "apps/web");
if (!(await exists(path.join(serverRoot, "server.js")))) {
  throw new Error("The Next.js standalone server entry was not generated.");
}

const pnpmRuntimeModules = path.join(
  stageRoot,
  "node_modules/.pnpm/node_modules"
);
if (!(await exists(pnpmRuntimeModules))) {
  throw new Error("The standalone pnpm runtime modules were not generated.");
}
await cp(pnpmRuntimeModules, path.join(serverRoot, "node_modules"), {
  dereference: true,
  recursive: true
});

await cp(path.join(webRoot, "public"), path.join(serverRoot, "public"), {
  recursive: true
});
await mkdir(path.join(serverRoot, ".next"), { recursive: true });
await cp(
  path.join(webRoot, ".next/static"),
  path.join(serverRoot, ".next/static"),
  { recursive: true }
);

process.stdout.write(`Staged desktop web runtime at ${stageRoot}\n`);
