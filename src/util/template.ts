/**
 * Renders a template string by replacing `{{var}}` placeholders with values from `vars`.
 *
 * Whitespace inside the braces is allowed (e.g. `{{ name }}`). Unknown variables
 * (not present in `vars`) render as an empty string rather than being left as-is
 * or throwing.
 */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
	return tpl.replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, (_match, key: string) => {
		return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : "";
	});
}
