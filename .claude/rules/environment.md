# Environment and Project Setup

## Node.js

We use **fnm** for Node.js version management. Default — **Node 22**.

```bash
# Switch to the required version
fnm use 22
```

## Package Manager

We use **pnpm** (not npm/yarn).

```bash
# Install dependencies
pnpm -C app install

# Start dev server
pnpm -C app dev

# Build the project
pnpm -C app build

# Start production preview
pnpm -C app preview

# Install a new package
pnpm -C app add <package-name>

# Install a dev dependency
pnpm -C app add -D <package-name>
```

## Hot reload — limitations

**`index.ds.css.twig` and `style/ds.json` do not support hot reload.**

The `ds-css.js` plugin generates CSS only on server start (`configResolved`). Changes to these files while the dev server is running are not applied automatically.

**After changing `index.ds.css.twig` or `ds.json`:**

```bash
# Option 1: regenerate manually (fast, no server restart needed)
node app/scripts/render-ds-css.mjs minimal --out app/src/generated-css-from-twig/minimal-ds.css

# Option 2: restart the dev server
pnpm -C app dev
```

Replacing only the `--out` file is picked up by Vite via file watching — the page will reload automatically after manual regeneration.
