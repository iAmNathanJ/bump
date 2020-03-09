// adapted from https://github.com/lucascaro/denoversion/blob/v1.0.2/git.ts
import { parse, encode, decode, join, colors } from "./deps.ts";

const { run, args, cwd, readFile, writeFile } = Deno;
const projectRoot = cwd();
const projectFilePath = join(projectRoot, "project.json");

if (import.meta.main) {
  const { _: [newVersion] } = parse(args);

  switch (newVersion) {
    case "major":
      await bump("major");
      break;
    case "minor":
      await bump("minor");
      break;
    case "patch":
      await bump("patch");
      break;
    default:
      exit(`invalid version argument: ${newVersion}`);
      break;
  }
}

async function bump(to: "major" | "minor" | "patch") {
  const { default: project } = await import("file://" + projectFilePath);
  let [major, minor, patch] = project.version
    .split(".")
    .map((n: string) => parseInt(n));
  let newVersion = "";

  if (to === "major") {
    minor = patch = 0;
    newVersion = `${major + 1}.${minor}.${patch}`;
  }
  if (to === "minor") {
    patch = 0;
    newVersion = `${major}.${minor + 1}.${patch}`;
  }
  if (to === "patch") {
    newVersion = `${major}.${minor}.${patch + 1}`;
  }

  await validateNewVersion(newVersion);

  const newProjectContent = JSON.stringify(
    { ...project, version: newVersion },
    null,
    2
  );

  await Promise.all([
    writeFile(projectFilePath, encode(newProjectContent + "\n")),
    updateTemplates(project.version, newVersion, project.replaceVersion)
  ]);

  await gitCommit(newVersion, project.name);
  await createTag(newVersion, project.signGitTag);
}

async function validateNewVersion(version: string | undefined) {
  if (!version) {
    return exit(`unable to determine new version: using "${version}"`);
  }

  if (!(await gitStatusClean())) {
    return exit(
      "git working tree not clean, please commit all changes before versioning"
    );
    return;
  }

  if (await tagExists(version)) {
    return exit(`version already exists: ${v(version)}`);
  }
}

async function gitStatusClean() {
  const git = run({
    args: ["git", "status", "--porcelain"],
    stdout: "piped"
  });
  const output = await git.output();
  return output.length === 0;
}

async function tagExists(version: string) {
  const git = run({
    args: ["git", "tag", "--list", v(version)],
    stdout: "piped"
  });
  const output = await git.output();
  return output.length > 0;
}

async function gitCommit(version: string, projectName: string) {
  await run({
    args: ["git", "add", "."]
  }).status();

  await run({
    args: ["git", "commit", "-m", `release: ${projectName}@${v(version)}`]
  }).status();
}

async function createTag(version: string, signGitTag = false) {
  const tagArgs = signGitTag ? "-as" : "-a";
  await run({
    args: ["git", "tag", tagArgs, v(version), "-m", `release: ${v(version)}`]
  }).status();
}

async function updateTemplates(
  oldVersion: string,
  newVersion: string,
  files = []
) {
  const matchVersion = new RegExp(`v${oldVersion}`, "g");

  await Promise.all(
    files
      .map((file: string) => join(projectRoot, file))
      .map(async (path: string) => {
        return {
          path,
          content: decode(await readFile(path)).replace(
            matchVersion,
            `v${newVersion}`
          )
        };
      })
      .map(async (prom: Promise<{ path: string; content: string }>) => {
        const { path, content } = await prom;
        writeFile(path, encode(content));
      })
  );
}

function v(version: string) {
  return version.startsWith("v") ? version : `v${version}`;
}

function exit(msg: string) {
  console.error(colors.red("error: ") + msg);
  Deno.exit(1);
}
