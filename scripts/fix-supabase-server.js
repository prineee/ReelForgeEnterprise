const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const EXTS = [".ts", ".tsx"];

let fixed = 0;

function walk(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    if (
      file === "node_modules" ||
      file === ".next" ||
      file === ".git"
    ) {
      continue;
    }

    const full = path.join(dir, file);

    if (fs.statSync(full).isDirectory()) {
      walk(full);
      continue;
    }

    if (!EXTS.includes(path.extname(full))) {
      continue;
    }

    let code = fs.readFileSync(full, "utf8");

    // Ignore client components
    if (
      code.includes('"use client"') ||
      code.includes("'use client'")
    ) {
      continue;
    }

    let changed = false;

    if (
      code.includes(
        "const supabase = await createClient()"
      )
    ) {
      code = code.replace(
        /const supabase = createClient\(\)/g,
        "const supabase = await createClient()"
      );

      changed = true;
    }

    if (
      changed &&
      !code.includes("async function") &&
      code.includes("export default function")
    ) {
      code = code.replace(
        "export default function",
        "export default async function"
      );
    }

    if (changed) {
      fs.writeFileSync(full, code);

      console.log("✓", full);

      fixed++;
    }
  }
}

walk(ROOT);

console.log("");

console.log("========================");

console.log("Files Fixed:", fixed);

console.log("========================");