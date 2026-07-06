import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.mts", "manifest.json"],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: [".json"],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ["**/*.ts", "**/*.tsx"],
		rules: {
			"no-undef": "off", // TypeScript handles undefined-variable detection
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.mts",
		"version-bump.mjs",
		"versions.json",
		"main.js",
		"vitest.config.ts",
		// Test-only infrastructure (vitest setup + obsidian stub), not plugin
		// runtime code; uses node/globalThis idioms the plugin rules forbid.
		"src/testing",
	]),
);
