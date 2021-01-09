# `bump`

![deno@v1.6.3](https://github.com/iAmNathanJ/bump/workflows/deno@v1.6.3/badge.svg)

This is my personal tool for versioning Deno projects. You might find it useful as well.

```sh
$ deno install --allow-read --allow-write --allow-run -n bump https://denopkg.com/iamnathanj/bump@v2.1.0/cli.ts
```

## Usage

Add a `project.json` to the root of your project:

```js
{
  "name": "your-deno-module", // required 
  "version": "0.0.0",         // required
  "replaceVersion": [         // optional
    "README.md"
  ],
  "signGitTag": true          // optional
}
```

Run `bump` in the root of your project:
```sh
$ bump major
```

This will:
- bump the version in your `project.json`
- replace version strings in the files specified by `project.json#replaceVersion`
- create a git commit with the new changes
- create a git tag for the new version

Make sure to `git push --follow-tags` to push the changes to your remote.

### Available version commands
- `major`
- `minor`
- `patch`

## Contributing
Please do open an issue or PR if you feel you have something valuable to add. 
