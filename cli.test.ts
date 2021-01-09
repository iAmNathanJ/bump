import { assert, assertEquals } from "./dev-deps.ts";
import { decode, encode, resolve } from "./deps.ts";
const { test, makeTempDir, readFile, writeFile } = Deno;

/**
 * testing strategy
 * scaffold new git repo in tmp directory for each test
 * run versioning commands
 */
async function setup(config = {}) {
  const projectRoot = await makeTempDir();
  const projectConfig = JSON.stringify({
    name: "bump",
    version: "1.0.0",
    replaceVersion: [
      "README.md",
    ],
    deno: {
      version: "1.0.0",
    },
    ...config,
  });
  const readme = "https://denopkg.com/iamnathanj/bump@v1.0.0/cli.ts";

  await writeFile(`${projectRoot}/project.json`, encode(projectConfig));
  await writeFile(`${projectRoot}/README.md`, encode(readme));
  await run("git init");
  await run("git config user.name testuser");
  await run("git config user.email testuser@test.com");
  await run("git config commit.gpgsign false");
  await run("git add .");
  await run("git commit -m 'initial'");

  async function run(args: string) {
    const cmd = Deno.run({
      cwd: projectRoot,
      cmd: args.split(" "),
      stdout: "piped",
      stderr: "piped",
    });

    const status = await cmd.status();
    const stdout = decode(await cmd.output());
    const stderr = decode(await cmd.stderrOutput());

    cmd.close();

    return { status, stdout, stderr };
  }

  async function bump(args: string) {
    return run(
      `deno run --allow-read --allow-write --allow-run ${
        resolve(
          "./cli.ts",
        )
      } ${args}`,
    );
  }

  async function cleanup() {
    const cmd = Deno.run({
      cmd: ["rm", "-rf", projectRoot],
      stdout: "piped",
      stderr: "piped",
    });
    await cmd.status();
    cmd.stdout?.close();
    cmd.stderr?.close();
    cmd.close();
  }

  return { projectRoot, run, bump, cleanup };
}

test("won't run on a dirty working tree", async () => {
  const { run, bump, cleanup } = await setup();
  await run("touch newfile.txt");

  const { stderr } = await bump("major");

  assert(stderr.includes("git working tree not clean"));
  await cleanup();
});

test("won't recreate an exisiting version", async () => {
  const { run, bump, cleanup } = await setup();
  await run("git tag v2.0.0");

  const { stderr } = await bump("major");

  assert(stderr.includes("version already exists"));
  await cleanup();
});

test("major", async () => {
  const { projectRoot, bump, cleanup } = await setup();

  await bump("major");
  const config = JSON.parse(
    decode(await readFile(`${projectRoot}/project.json`)),
  );

  assertEquals(config.version, "2.0.0");
  await cleanup();
});

test("minor", async () => {
  const { projectRoot, bump, cleanup } = await setup();

  await bump("minor");
  const config = JSON.parse(
    decode(await readFile(`${projectRoot}/project.json`)),
  );

  assertEquals(config.version, "1.1.0");
  await cleanup();
});

test("patch", async () => {
  const { projectRoot, bump, cleanup } = await setup();

  await bump("patch");
  const config = JSON.parse(
    decode(await readFile(`${projectRoot}/project.json`)),
  );

  assertEquals(config.version, "1.0.1");
  await cleanup();
});

// todo test("explicit version", () => {});

test("replaces version string in files", async () => {
  const { projectRoot, bump, cleanup } = await setup();

  await bump("major");
  const readme = decode(await readFile(`${projectRoot}/README.md`));

  assert(!readme.includes("bump@v1.0.0"));
  assert(readme.includes("bump@v2.0.0"));
  await cleanup();
});

test("creates a new commit", async () => {
  const { run, bump, cleanup } = await setup();

  await bump("minor");
  const { stdout } = await run("git log --oneline");

  assert(stdout.includes("release: bump@v1.1.0"));
  await cleanup();
});

test("creates a new tag", async () => {
  const { run, bump, cleanup } = await setup();

  await bump("minor");
  const { stdout } = await run("git tag --list v1.1.0");

  assert(stdout.includes("v1.1.0"));
  await cleanup();
});
