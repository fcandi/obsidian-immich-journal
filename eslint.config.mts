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
	{
		// Mirror the type-aware rules the community-directory review bot
		// layers on top of the plugin's recommended config, so bot findings
		// fail locally before a release is tagged. Root-cause lesson (Garmin
		// plugin 0.10.0, 2026-08-02): a tsconfig `lib` older than the APIs
		// the code uses makes calls like Object.entries/padStart error-typed
		// in the bot's environment, cascading into dozens of no-unsafe-*
		// findings that a lint run without these rules never shows.
		files: ["src/**/*.ts"],
		rules: {
			"@typescript-eslint/no-unsafe-call": "error",
			"@typescript-eslint/no-unsafe-assignment": "error",
			"@typescript-eslint/no-unsafe-argument": "error",
			"@typescript-eslint/no-unsafe-member-access": "error",
			"@typescript-eslint/no-unsafe-return": "error",
			"@typescript-eslint/no-unnecessary-type-assertion": "error",
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
