# Add a plugin

Create the plugin under `plugins/`, then register it in `.cursor-plugin/marketplace.json`.

## 1. Create the plugin folder

```text
plugins/my-new-plugin/
plugins/my-new-plugin/.cursor-plugin/plugin.json
```

Example `plugin.json`:

```json
{
  "name": "my-new-plugin",
  "displayName": "My New Plugin",
  "version": "0.1.0",
  "description": "Describe what this plugin does",
  "author": {
    "name": "Matt Palmer"
  },
  "logo": "assets/logo.svg"
}
```

## 2. Add only the components you need

- `rules/` with `.mdc` files (YAML frontmatter required)
- `skills/<skill-name>/SKILL.md` (YAML frontmatter required)
- `agents/*.md` (YAML frontmatter required)
- `commands/*.(md|mdc|markdown|txt)` (frontmatter recommended)
- `hooks/hooks.json` and `scripts/` for automation hooks
- `mcp.json` for MCP servers
- `assets/logo.svg` for marketplace display

Keep component paths relative to the plugin root. Do not use `..` or absolute paths in manifests.

## 3. Register the plugin in the marketplace

Append an entry to `.cursor-plugin/marketplace.json`:

```json
{
  "name": "my-new-plugin",
  "source": "my-new-plugin",
  "description": "Describe your plugin"
}
```

`source` is relative to `metadata.pluginRoot` (`plugins/` in this repo).

## 4. Validate

```bash
node scripts/validate-template.mjs
```

Fix every reported error before committing.

## 5. Common pitfalls

- Plugin `name` is not kebab-case.
- Marketplace `source` does not match the folder name under `plugins/`.
- Plugin folder is missing `.cursor-plugin/plugin.json`.
- Skills, agents, or commands are missing frontmatter `name` and `description`.
- Rule files are missing frontmatter `description`.
- MCP config uses a filename other than `mcp.json`.
- `logo`, `hooks`, or `mcpServers` paths are broken or not plugin-relative.
