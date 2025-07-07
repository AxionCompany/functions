import { ensureDir } from 'jsr:@std/fs@1.0.19';
import { join } from 'jsr:@std/path@1.1.1';

/**
 * Prompts the user for input.
 * @param message The message to display to the user.
 * @param defaultVal The default value if the user provides no input.
 * @returns The user's input or the default value.
 */
async function prompt(message: string, defaultVal?: string): Promise<string | null> {
  const buf = new Uint8Array(1024);
  await Deno.stdout.write(new TextEncoder().encode(`${message} `));
  const n = <number>await Deno.stdin.read(buf);
  const text = new TextDecoder().decode(buf.subarray(0, n)).trim();
  return text.length > 0 ? text : defaultVal || null;
}


async function scaffold() {
    console.log("🚀 Welcome to Oxian.js!");
    console.log("Let's create a new project.");
    console.log("");

    const projectNameAnswer = await prompt("Enter your project name:", "my-oxian-app");
    const projectName = projectNameAnswer?.trim();

    if (!projectName) {
        console.error("❌ Project name is required.");
        return;
    }

    const projectDir = join(Deno.cwd(), projectName);
    await ensureDir(projectDir);

    // --- Create deno.json ---
    const denoJsonContent = {
      "name": `@user/${projectName}`,
      "version": "0.1.0",
      "tasks": {
        "start": "deno run -A --unstable-kv --unstable-cron jsr:@oxian/oxian-js@^0.2.0"
      },
    };
    await Deno.writeTextFile(join(projectDir, "deno.json"), JSON.stringify(denoJsonContent, null, 2));

    // --- Create oxian.config.ts ---
    const oxianConfigContent = `// For more information on configuration, visit https://oxian.js.org/docs/configuration
import type { OxianConfig } from "jsr:@oxian/oxian-js/config";

export default {
  functionsDir: "./functions",
  // Add other configurations here
} satisfies OxianConfig;
`;
    await Deno.writeTextFile(join(projectDir, "oxian.config.ts"), oxianConfigContent);

    // --- Create functions directory and a sample function ---
    const functionsDir = join(projectDir, "functions");
    await ensureDir(functionsDir);

    const helloTsContent = `export default (request: Request) => {
    return new Response("Hello from Oxian.js!", {
        headers: { "content-type": "text/plain" },
    });
};
`;
    await Deno.writeTextFile(join(functionsDir, "hello.ts"), helloTsContent);

    // --- Create .gitignore ---
    const gitignoreContent = `# Deno
deno.lock
.vscode/

# Oxian.js
.oxian/
`;
    await Deno.writeTextFile(join(projectDir, ".gitignore"), gitignoreContent);

    console.log(`\n✅ Project created successfully in './${projectName}'`);
    console.log("\nTo get started, run the following commands:");
    console.log(`  cd ${projectName}`);
    console.log("  deno task start");
    console.log("\nYour new function is available at http://localhost:8000/hello");
}

if (import.meta.main) {
  await scaffold();
} 