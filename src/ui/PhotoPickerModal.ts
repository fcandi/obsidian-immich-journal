import { App, Modal } from "obsidian";
import { ImmichClient, ImmichError } from "../api/immichClient";
import { t } from "../i18n";
import type { ImmichAsset, PluginSettings } from "../types";
import {
	LONG_PRESS_MS,
	overlayInfo,
	selectedAssetsInCaptureOrder,
} from "./photoGrid";

/** Number of placeholder cells shown in the loading skeleton grid. */
const SKELETON_CELL_COUNT = 8;

/** Dependencies injected into the modal by the plugin entry point. */
export interface PhotoPickerModalDeps {
	client: ImmichClient;
	settings: PluginSettings;
	/**
	 * Day to load on open, "YYYY-MM-DD", or `null` when no date could be
	 * derived from the note (the user then picks one via the date input).
	 */
	initialDate: string | null;
	/** Called with the selected assets when the user confirms the insert. */
	onInsert: (assets: ImmichAsset[]) => Promise<void>;
}

/** UI states of the modal body. */
type ModalState = "loading" | "empty" | "error" | "loaded";

/** Matches a complete "YYYY-MM-DD" day string. */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shifts a "YYYY-MM-DD" day string by `deltaDays`, using pure UTC date math so
 * the result never depends on the local timezone or DST transitions.
 */
export function shiftDay(day: string, deltaDays: number): string {
	const [year, month, dayOfMonth] = day.split("-").map(Number);
	const shifted = new Date(
		Date.UTC(year, month - 1, dayOfMonth + deltaDays)
	);
	const y = shifted.getUTCFullYear().toString().padStart(4, "0");
	const m = (shifted.getUTCMonth() + 1).toString().padStart(2, "0");
	const d = shifted.getUTCDate().toString().padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/**
 * Photo picker modal: shows the photos taken on a given day and lets the user
 * select some of them for insertion into the note.
 *
 * This class owns the header (date display, prev/next day navigation, direct
 * date input), the body state machine (loading skeleton / empty / error /
 * loaded grid) and the selection + footer state. Grid cell rendering
 * (lazy thumbnails, multi-select, info overlay) lives in {@link renderGrid};
 * pure helpers are in `photoGrid.ts`.
 */
export class PhotoPickerModal extends Modal {
	private readonly deps: PhotoPickerModalDeps;

	/** Currently displayed day ("YYYY-MM-DD"), or null until the user picks one. */
	private currentDate: string | null;

	/** Assets of the currently loaded day. */
	private assets: ImmichAsset[] = [];

	/**
	 * Ids of the assets the user has selected.
	 *
	 * Deliberately NOT named `selection`: Obsidian's `Modal` base class owns an
	 * (undocumented) instance property of that name — it stores the text
	 * selection to restore on close — and assigns over any same-named subclass
	 * field, which silently replaces the Set and crashes every handler that
	 * touches it.
	 */
	protected readonly selectedIds = new Set<string>();

	/**
	 * Monotonically increasing token identifying the latest load request.
	 * Responses carrying an older token are stale and must be dropped so a
	 * slow response for a previously shown day cannot clobber the current one.
	 */
	private requestToken = 0;

	/** Lazy-loads thumbnails as cells scroll into view; one observer per grid. */
	private observer: IntersectionObserver | null = null;

	/** Object URLs created for thumbnails; all revoked in {@link onClose}. */
	private readonly objectUrls: string[] = [];

	// Elements that outlive a single state render.
	private headerEl!: HTMLElement;
	private dateDisplayEl!: HTMLElement;
	private dateInputEl!: HTMLInputElement;
	private bodyEl!: HTMLElement;
	private footerEl!: HTMLElement;
	private countEl!: HTMLElement;
	private insertBtnEl!: HTMLButtonElement;

	constructor(app: App, deps: PhotoPickerModalDeps) {
		super(app);
		this.deps = deps;
		this.currentDate = deps.initialDate;
	}

	onOpen(): void {
		this.modalEl.addClass("immich-journal-modal");
		this.contentEl.empty();

		this.renderHeader();
		this.bodyEl = this.contentEl.createDiv({
			cls: "immich-journal-body",
		});
		this.renderFooter();

		if (this.currentDate) {
			void this.loadDay(this.currentDate);
		}
	}

	onClose(): void {
		// Invalidate any in-flight request so its completion is a no-op.
		this.requestToken++;
		this.observer?.disconnect();
		this.observer = null;
		for (const url of this.objectUrls) {
			URL.revokeObjectURL(url);
		}
		this.objectUrls.length = 0;
		this.contentEl.empty();
	}

	// ------------------------------------------------------------------ header

	private renderHeader(): void {
		this.headerEl = this.contentEl.createDiv({
			cls: "immich-journal-header",
		});

		const prevBtn = this.headerEl.createEl("button", {
			cls: "immich-journal-nav-btn",
			text: "◀",
			attr: { "aria-label": t("modal.prevDay") },
		});
		prevBtn.addEventListener("click", () => this.shiftCurrentDay(-1));

		this.dateDisplayEl = this.headerEl.createDiv({
			cls: "immich-journal-date",
		});

		const nextBtn = this.headerEl.createEl("button", {
			cls: "immich-journal-nav-btn",
			text: "▶",
			attr: { "aria-label": t("modal.nextDay") },
		});
		nextBtn.addEventListener("click", () => this.shiftCurrentDay(1));

		this.dateInputEl = this.headerEl.createEl("input", {
			cls: "immich-journal-date-input",
			type: "date",
			attr: {
				"aria-label": t("modal.datePlaceholder"),
				placeholder: t("modal.datePlaceholder"),
			},
		});
		// No date derived from the note: make the input the prominent way in.
		this.dateInputEl.toggleClass(
			"immich-journal-date-input-prominent",
			this.currentDate === null
		);
		this.dateInputEl.addEventListener("change", () => {
			const value = this.dateInputEl.value;
			if (DAY_RE.test(value)) {
				this.setDate(value);
			}
		});

		this.updateHeader();
	}

	private updateHeader(): void {
		this.dateDisplayEl.setText(
			this.currentDate
				? t("modal.title", { date: this.currentDate })
				: t("modal.datePlaceholder")
		);
		if (this.currentDate) {
			this.dateInputEl.value = this.currentDate;
			this.dateInputEl.removeClass(
				"immich-journal-date-input-prominent"
			);
		}
	}

	private shiftCurrentDay(deltaDays: number): void {
		// Without a current date there is nothing to shift from.
		if (!this.currentDate) {
			return;
		}
		this.setDate(shiftDay(this.currentDate, deltaDays));
	}

	/** Switches to a new day and (re)loads its assets. */
	private setDate(day: string): void {
		if (day === this.currentDate) {
			return;
		}
		this.currentDate = day;
		this.selectedIds.clear();
		this.updateHeader();
		this.updateFooter();
		void this.loadDay(day);
	}

	// ----------------------------------------------------------------- loading

	private async loadDay(day: string): Promise<void> {
		const token = ++this.requestToken;
		this.renderState("loading");

		let loaded: ImmichAsset[];
		try {
			loaded = await this.deps.client.searchDayAssets(day);
		} catch (error) {
			if (token !== this.requestToken) {
				return; // Stale response for a day no longer shown.
			}
			this.renderState("error", this.errorMessage(error));
			return;
		}

		if (token !== this.requestToken) {
			return; // Stale response for a day no longer shown.
		}

		this.assets = loaded;
		if (loaded.length === 0) {
			this.renderState("empty");
		} else {
			this.renderState("loaded");
		}
	}

	/** Maps an error thrown by the client to a user-facing, localized message. */
	private errorMessage(error: unknown): string {
		if (error instanceof ImmichError) {
			switch (error.category) {
				case "network":
					return t("modal.errorNetwork");
				case "unauthorized":
					return t("modal.errorUnauthorized");
				case "forbidden":
					return t("modal.errorForbidden");
				default:
					return t("modal.errorGeneric");
			}
		}
		return t("modal.errorGeneric");
	}

	// ------------------------------------------------------------ body states

	private renderState(state: ModalState, errorMessage?: string): void {
		this.bodyEl.empty();

		switch (state) {
			case "loading": {
				const loading = this.bodyEl.createDiv({
					cls: "immich-journal-state-loading",
					attr: { "aria-label": t("modal.loading") },
				});
				const skeleton = loading.createDiv({
					cls: "immich-journal-skeleton-grid",
				});
				for (let i = 0; i < SKELETON_CELL_COUNT; i++) {
					skeleton.createDiv({
						cls: "immich-journal-skeleton-cell",
					});
				}
				break;
			}
			case "empty": {
				this.bodyEl.createDiv({
					cls: "immich-journal-state-empty",
					text: t("modal.empty"),
				});
				break;
			}
			case "error": {
				this.bodyEl.createDiv({
					cls: "immich-journal-state-error",
					text: errorMessage ?? t("modal.errorGeneric"),
				});
				break;
			}
			case "loaded": {
				const grid = this.bodyEl.createDiv({
					cls: "immich-journal-grid",
				});
				this.renderGrid(grid, this.assets);
				break;
			}
		}

		this.updateFooter();
	}

	/**
	 * Renders the photo grid into `container`: one selectable cell per asset
	 * with a lazily loaded thumbnail, a selection checkmark and an info
	 * overlay (hover on desktop, long-press on touch devices).
	 */
	protected renderGrid(container: HTMLElement, assets: ImmichAsset[]): void {
		// Column count is a CSS custom property; the stylesheet overrides it
		// to a fixed mobile value on narrow viewports.
		container.style.setProperty(
			"--immich-journal-cols",
			String(this.deps.settings.gridColsDesktop)
		);

		// A fresh grid replaces any previous one (e.g. after day navigation),
		// so drop the old observer before wiring up the new cells.
		this.observer?.disconnect();
		const cellTargets = new Map<
			Element,
			{ asset: ImmichAsset; img: HTMLImageElement }
		>();
		this.observer = new IntersectionObserver(
			(entries, observer) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) {
						continue;
					}
					// Each cell is observed exactly once: stop observing as
					// soon as its thumbnail load has been kicked off.
					observer.unobserve(entry.target);
					const target = cellTargets.get(entry.target);
					cellTargets.delete(entry.target);
					if (target) {
						void this.loadThumbnail(target.asset, target.img);
					}
				}
			},
			{ root: this.bodyEl, rootMargin: "200px" }
		);

		for (const asset of assets) {
			const { cell, img } = this.renderCell(container, asset);
			cellTargets.set(cell, { asset, img });
			this.observer.observe(cell);
		}
	}

	/** Builds a single grid cell (thumbnail, checkmark, overlay, interactions). */
	private renderCell(
		container: HTMLElement,
		asset: ImmichAsset
	): { cell: HTMLElement; img: HTMLImageElement } {
		const cell = container.createDiv({ cls: "immich-journal-cell" });

		const img = cell.createEl("img", {
			cls: "immich-journal-thumb",
			attr: {
				alt: asset.originalFileName,
				draggable: "false",
			},
		});

		cell.createDiv({
			cls: "immich-journal-check",
			text: "✓",
			attr: { "aria-hidden": "true" },
		});

		const overlay = cell.createDiv({ cls: "immich-journal-overlay" });
		const info = overlayInfo(asset);
		overlay.createDiv({ text: info.time });
		if (info.description) {
			overlay.createDiv({ text: info.description });
		}

		// --- selection (tap/click toggles) ---------------------------------
		// A long-press that showed the overlay must not also toggle the
		// selection via the synthetic click fired after touchend.
		let suppressNextClick = false;
		cell.addEventListener("click", () => {
			if (suppressNextClick) {
				suppressNextClick = false;
				return;
			}
			this.toggleSelection(asset.id, cell);
		});

		// --- long-press overlay (mobile; desktop hover is pure CSS) --------
		// The overlay is revealed with inline styles so the stylesheet only
		// needs to handle the :hover case.
		let longPressTimer: ReturnType<typeof setTimeout> | null = null;
		const hideOverlay = () => {
			overlay.style.removeProperty("opacity");
			overlay.style.removeProperty("visibility");
		};
		const cancelLongPress = (suppressClick: boolean) => {
			if (longPressTimer !== null) {
				clearTimeout(longPressTimer);
				longPressTimer = null;
			}
			if (overlay.style.opacity !== "") {
				hideOverlay();
				suppressNextClick = suppressClick;
			}
		};
		cell.addEventListener(
			"touchstart",
			() => {
				longPressTimer = setTimeout(() => {
					longPressTimer = null;
					overlay.style.opacity = "1";
					overlay.style.visibility = "visible";
				}, LONG_PRESS_MS);
			},
			{ passive: true }
		);
		cell.addEventListener("touchend", () => cancelLongPress(true));
		// Scrolling or dragging cancels the long-press without suppressing
		// anything — no click follows a moved touch anyway.
		cell.addEventListener(
			"touchmove",
			() => cancelLongPress(false),
			{ passive: true }
		);
		cell.addEventListener("touchcancel", () => cancelLongPress(false));

		return { cell, img };
	}

	/** Fetches an asset's small thumbnail and shows it in `img` via object URL. */
	private async loadThumbnail(
		asset: ImmichAsset,
		img: HTMLImageElement
	): Promise<void> {
		const token = this.requestToken;
		let bytes: ArrayBuffer;
		try {
			bytes = await this.deps.client.fetchThumbnail(
				asset.id,
				"thumbnail"
			);
		} catch {
			// A failed thumbnail must not break the grid; the cell simply
			// stays empty (the alt text remains visible).
			return;
		}
		const url = URL.createObjectURL(
			new Blob([bytes], { type: "image/jpeg" })
		);
		if (token !== this.requestToken) {
			// The modal was closed or the day changed while fetching; the
			// grid this cell belonged to is gone, so free the URL right away.
			URL.revokeObjectURL(url);
			return;
		}
		this.objectUrls.push(url);
		img.src = url;
	}

	/** Toggles an asset's selection state and refreshes cell + footer. */
	private toggleSelection(assetId: string, cell: HTMLElement): void {
		if (this.selectedIds.has(assetId)) {
			this.selectedIds.delete(assetId);
		} else {
			this.selectedIds.add(assetId);
		}
		cell.toggleClass(
			"immich-journal-cell-selected",
			this.selectedIds.has(assetId)
		);
		this.updateFooter();
	}

	// ----------------------------------------------------------------- footer

	private renderFooter(): void {
		this.footerEl = this.contentEl.createDiv({
			cls: "immich-journal-footer",
		});
		// Explicit cancel button: on mobile the modal is a full-height sheet
		// whose top-right X can sit in the unreachable status-bar zone, so the
		// footer provides an always-tappable way out.
		const cancelBtn = this.footerEl.createEl("button", {
			cls: "immich-journal-cancel-btn",
			text: t("modal.cancelButton"),
		});
		cancelBtn.addEventListener("click", () => this.close());
		this.countEl = this.footerEl.createDiv({
			cls: "immich-journal-count",
		});
		this.insertBtnEl = this.footerEl.createEl("button", {
			cls: "immich-journal-insert-btn",
			text: t("modal.insertButton"),
		});
		this.insertBtnEl.addEventListener("click", () => {
			void this.handleInsert();
		});
		this.updateFooter();
	}

	/** Refreshes the selection count and insert button enabled-state. */
	protected updateFooter(): void {
		this.countEl.setText(
			t("modal.selectedCount", {
				count: String(this.selectedIds.size),
			})
		);
		this.insertBtnEl.disabled = this.selectedIds.size === 0;
	}

	private async handleInsert(): Promise<void> {
		// Selection order does not matter: always insert in capture order.
		const selected = selectedAssetsInCaptureOrder(
			this.assets,
			this.selectedIds
		);
		if (selected.length === 0) {
			return;
		}
		this.insertBtnEl.disabled = true;
		try {
			await this.deps.onInsert(selected);
			this.close();
		} finally {
			this.insertBtnEl.disabled = this.selectedIds.size === 0;
		}
	}
}
