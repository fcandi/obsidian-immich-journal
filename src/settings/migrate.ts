/**
 * Settings migrations, applied to raw persisted data before it is merged
 * with the defaults in main.ts.
 *
 * 0.1.x → 0.2.0: `embedStyle` + `linkToImmich` + `captionTemplate` were
 * replaced by a single `embedPreset` dropdown. Users who never touched the
 * templates map onto the matching preset; users with a customized markdown
 * or caption template land on the "custom" preset with a template that
 * reproduces their previous output exactly (caption template inlined,
 * outer link stripped when the toggle was off, wikilink form spelled out).
 */

import { PluginSettings } from "../types";
import { stripOuterLink } from "../insert/markdownBlock";

/** Legacy (pre-0.2.0) persisted fields this migration consumes. */
export interface LegacyEmbedFields {
	embedStyle?: "markdown" | "wikilink";
	linkToImmich?: boolean;
	captionTemplate?: string;
}

const LEGACY_DEFAULT_MARKDOWN_TEMPLATE =
	"[![{{altText}}]({{localPath}})]({{immichUrl}})\n*{{caption}}*";
const LEGACY_DEFAULT_CAPTION_TEMPLATE = "{{description}}";

/** Replace `{{caption}}` placeholders with the caption template's content. */
function inlineCaption(template: string, captionTemplate: string): string {
	return template.replace(/\{\{\s*caption\s*\}\}/g, captionTemplate);
}

/**
 * Migrate legacy embed fields on `loaded` (raw `loadData()` output) in
 * place: derive `embedPreset`/`markdownTemplate` and delete the legacy
 * keys. Data that already carries `embedPreset`, or fresh installs without
 * any legacy keys, are left untouched (defaults apply via the merge).
 */
export function migrateEmbedSettings(
	loaded: Partial<PluginSettings> & LegacyEmbedFields
): void {
	const hasLegacyKeys =
		loaded.embedStyle !== undefined ||
		loaded.linkToImmich !== undefined ||
		loaded.captionTemplate !== undefined;

	if (loaded.embedPreset !== undefined || !hasLegacyKeys) {
		delete loaded.embedStyle;
		delete loaded.linkToImmich;
		delete loaded.captionTemplate;
		return;
	}

	const embedStyle = loaded.embedStyle ?? "markdown";
	const linkToImmich = loaded.linkToImmich ?? true;
	const captionTemplate =
		loaded.captionTemplate ?? LEGACY_DEFAULT_CAPTION_TEMPLATE;
	const markdownTemplate =
		loaded.markdownTemplate ?? LEGACY_DEFAULT_MARKDOWN_TEMPLATE;

	const customized =
		markdownTemplate !== LEGACY_DEFAULT_MARKDOWN_TEMPLATE ||
		captionTemplate !== LEGACY_DEFAULT_CAPTION_TEMPLATE;

	if (!customized) {
		loaded.embedPreset =
			embedStyle === "wikilink"
				? "wikilink"
				: linkToImmich
					? "markdownLink"
					: "markdownPlain";
		// Let the merge fill in the new default template (which inlines
		// {{description}} instead of the removed {{caption}} variable).
		delete loaded.markdownTemplate;
	} else {
		// Reproduce the legacy rendering exactly. For the wikilink style the
		// markdown template was ignored entirely, so the effective output was
		// always the fixed wikilink embed plus the caption line.
		const base =
			embedStyle === "wikilink"
				? "![[{{localPathRaw}}]]\n*{{caption}}*"
				: linkToImmich
					? markdownTemplate
					: stripOuterLink(markdownTemplate);
		loaded.embedPreset = "custom";
		loaded.markdownTemplate = inlineCaption(base, captionTemplate);
	}

	delete loaded.embedStyle;
	delete loaded.linkToImmich;
	delete loaded.captionTemplate;
}
