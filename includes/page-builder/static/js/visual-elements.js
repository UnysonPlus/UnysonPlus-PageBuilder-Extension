(function($, itemData) {
	var responsive_class = 'fw-responsive-controls',
		display_class = 'fw-display-controls',
		allowed_width = 280;

	// device-preview.js exposes the active device as window.fwPbDevice (lg|md|sm)
	// and fires 'fw:builder:device-preview'. The eye/menu hide for the previewed
	// breakpoint via the shared responsive_hide ("Hide on") option — the SAME data
	// the Live Editor uses, so both editors + the Advanced tab stay in sync.
	var DEVICE_HIDE  = { lg: 'hide-md', md: 'hide-sm', sm: 'hide-xs' };
	var DEVICE_LABEL = { lg: 'Desktop', md: 'Tablet', sm: 'Mobile' };

	// Shared clipboards (localStorage) — same keys + shapes the Live Editor uses.
	var CLIPBOARD_KEY = 'fw-pb-clipboard';
	var SETTINGS_KEY  = 'fw-pb-settings-clipboard';
	// Option types treated as CONTENT (excluded from "copy settings").
	var CONTENT_TYPES = { 'text': 1, 'textarea': 1, 'wp-editor': 1, 'wp_editor': 1 };

	function l10n(key, fallback) {
		return (itemData.l10n && itemData.l10n[key]) || fallback;
	}

	// A small auto-dismissing toast (the backend equivalent of the Live Editor's
	// status pill) — shown on copy / copy-settings / paste.
	var $toast = null, toastTimer = null;
	function toast(msg) {
		if (!$toast) { $toast = $('<div class="fw-pb-toast" role="status"></div>').appendTo('body'); }
		$toast.text(msg).addClass('is-visible');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(function () { $toast.removeClass('is-visible'); }, 1600);
	}

	// The item currently under the cursor — the target for keyboard shortcuts
	// (the backend has no persistent selection, so "hovered" is the active item).
	var hoveredEntry = null;

	/** The deepest registered item whose element contains `target` (or null). */
	function itemAt(target) {
		var hit = null;
		_.each(registry, function (entry) {
			var el = entry.model.view && entry.model.view.el;
			if (el && el.contains(target)) {
				if (!hit || hit.el.contains(el)) { hit = { el: el, entry: entry }; }
			}
		});
		return hit;
	}

	/* ---- shared helpers --------------------------------------------------- */

	function genUid() {
		var s = '', i;
		if (window.crypto && window.crypto.getRandomValues) {
			var a = new Uint8Array(16);
			window.crypto.getRandomValues(a);
			for (i = 0; i < a.length; i++) { s += ('0' + a[i].toString(16)).slice(-2); }
			return s;
		}
		for (i = 0; i < 32; i++) { s += Math.floor(Math.random() * 16).toString(16); }
		return s;
	}

	function regenIds(node) {
		var clone = JSON.parse(JSON.stringify(node));
		(function regen(n) {
			var nid = genUid();
			if (n.atts && typeof n.atts === 'object') { n.atts.unique_id = nid; }
			if (Object.prototype.hasOwnProperty.call(n, 'unique_id')) { n.unique_id = nid; }
			if (_.isArray(n._items)) { _.each(n._items, regen); }
		})(clone);
		return clone;
	}

	function kindOf(node) {
		var t = node && node.type;
		if (t === 'column') { return 'column'; }
		if (window.fwSectionLikeTypes && window.fwSectionLikeTypes.isSectionLike(t)) { return 'section'; }
		if (/section$/.test(t || '')) { return 'section'; }
		return 'element';
	}

	/** Walk an options tree → flat map of leaf option id → type. */
	function optionLeafTypes(options) {
		var map = {};
		(function visit(node) {
			if (!node) { return; }
			if (_.isArray(node)) { _.each(node, visit); return; }
			if (typeof node !== 'object') { return; }
			_.each(_.keys(node), function(id) {
				var def = node[id];
				if (!def || typeof def !== 'object') { return; }
				if (def.type === 'multi-picker' || def.picker) { map[id] = def.type || 'multi-picker'; return; }
				if (def.options) { visit(def.options); return; }
				map[id] = def.type || '';
			});
		})(options);
		return map;
	}

	function itemOptions(model) {
		return (model.view && model.view.initOptions && model.view.initOptions.modalOptions) || [];
	}

	function readClipboard() {
		try {
			var raw = window.localStorage.getItem(CLIPBOARD_KEY);
			if (!raw) { return null; }
			var data = JSON.parse(raw);
			return (data && data.item && typeof data.item === 'object') ? data.item : null;
		} catch (e) { return null; }
	}

	function readSettingsClipboard() {
		try {
			var raw = window.localStorage.getItem(SETTINGS_KEY);
			if (!raw) { return null; }
			var data = JSON.parse(raw);
			return (data && data.settings && typeof data.settings === 'object') ? data : null;
		} catch (e) { return null; }
	}

	function copyModel(model) {
		try {
			window.localStorage.setItem(CLIPBOARD_KEY, JSON.stringify({
				v: 1, item: JSON.parse(JSON.stringify(model.toJSON()))
			}));
			toast(l10n('copied', 'Copied'));
		} catch (e) { window.console && console.error('[fw-pb] copy failed', e); }
	}

	/** Copy an element's settings — every att EXCEPT content + unique_id. */
	function copySettings(model) {
		var types = optionLeafTypes(itemOptions(model));
		var atts = model.get('atts') || {};
		var settings = {};
		_.each(_.keys(atts), function(k) {
			if (k === 'unique_id') { return; }
			if (CONTENT_TYPES[types[k]]) { return; }
			settings[k] = atts[k];
		});
		try {
			window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({
				v: 1, tag: model.get('shortcode'), settings: JSON.parse(JSON.stringify(settings))
			}));
			toast(l10n('settingsCopied', 'Settings copied'));
		} catch (e) { window.console && console.error('[fw-pb] copy settings failed', e); }
	}

	/** Apply copied settings onto an element — only keys it has, never content. */
	function pasteSettings(model) {
		var clip = readSettingsClipboard();
		if (!clip) {
			fw.notify(l10n('noSettings', 'No settings copied yet — use "Copy Settings" first.'), 'warning');
			return;
		}
		var types = optionLeafTypes(itemOptions(model));
		var atts = _.clone(model.get('atts') || {});
		var applied = 0;
		_.each(_.keys(clip.settings), function(k) {
			if (!(k in types)) { return; }
			if (CONTENT_TYPES[types[k]]) { return; }
			atts[k] = clip.settings[k];
			applied++;
		});
		if (!applied) {
			fw.notify(l10n('noSettingsApplied', 'None of the copied settings apply to this element.'), 'warning');
			return;
		}
		model.set('atts', atts);
		// Keep a cached options modal in sync (built once, reused).
		if (model.view && model.view.modal && _.isFunction(model.view.modal.set)) {
			model.view.modal.set('values', _.clone(atts), { silent: true });
		}
		toast(l10n('settingsPasted', 'Settings pasted'));
	}

	function acceptsInto(targetKind, childKind) {
		return (targetKind === 'section' && childKind === 'column') ||
			(targetKind === 'column' && childKind === 'element');
	}

	/** Paste a fresh-id copy of the clipboard item relative to the clicked item. */
	function pasteRelativeTo(model, builder) {
		var clip = readClipboard();
		if (!clip) {
			fw.notify(l10n('clipboardEmpty', 'Nothing to paste — copy an element first.'), 'warning');
			return;
		}
		var kind = kindOf(clip);
		var targetKind = kindOf(model.toJSON());
		var fresh = regenIds(clip);

		if (kind === targetKind) {
			var coll = model.collection;
			if (coll) { coll.add(fresh, { at: coll.indexOf(model) + 1 }); toast(l10n('pasted', 'Pasted')); }
			return;
		}
		if (acceptsInto(targetKind, kind)) {
			var into = model.get('_items');
			if (into && into.add) { into.add(fresh); toast(l10n('pasted', 'Pasted')); }
			return;
		}
		if (kind === 'section' && builder && builder.rootItems) {
			builder.rootItems.add(fresh);
			toast(l10n('pasted', 'Pasted'));
			return;
		}
		fw.notify(kind === 'column'
			? l10n('pasteNeedSection', 'Paste a column after another column, or onto a section.')
			: l10n('pasteNeedColumn', 'Paste an element after another element, or onto a column.'), 'warning');
	}

	/* ---- device-aware hide ------------------------------------------------ */

	function currentHideClass() { return DEVICE_HIDE[window.fwPbDevice] || DEVICE_HIDE.lg; }

	function getResponsiveHide(model) {
		var atts = model.get('atts') || {};
		var rh = atts.responsive_hide;
		return (rh && !_.isArray(rh) && _.isObject(rh)) ? rh : {};
	}

	function hiddenOnCurrent(model) { return !!getResponsiveHide(model)[currentHideClass()]; }

	function toggleCurrent(model) {
		var cls = currentHideClass();
		var atts = _.clone(model.get('atts') || {});
		var rh = _.clone(getResponsiveHide(model));
		if (rh[cls]) { delete rh[cls]; } else { rh[cls] = true; }
		atts.responsive_hide = rh;
		model.set('atts', atts);
		if (model.view && model.view.modal && _.isFunction(model.view.modal.set)) {
			model.view.modal.set('values', _.clone(atts), { silent: true });
		}
		refreshDim(model);
	}

	function refreshDim(model) {
		if (model.view && model.view.$el) {
			model.view.$el.toggleClass('fw-visibility-off', hiddenOnCurrent(model));
		}
	}

	// Registry of items with controls, so a device switch + right-click work.
	var registry = [];

	function refreshAllDims() {
		registry = _.filter(registry, function(entry) {
			if (!entry.model.view || !entry.model.view.$el || !entry.model.view.$el.closest('body').length) {
				return false;
			}
			refreshDim(entry.model);
			return true;
		});
	}

	/* ---- the action menu -------------------------------------------------- */

	var $menu = null;

	function closeMenu() {
		if ($menu) {
			$menu.remove();
			$menu = null;
			$(document).off('mousedown.fwPbMenu keydown.fwPbMenu');
			$(window).off('scroll.fwPbMenu resize.fwPbMenu');
		}
	}

	function trigger(model, selector) {
		var $i = model.view.$el.find(selector).first();
		if ($i.length) { $i.trigger('click'); }
	}

	function openMenu(model, builder, x, y) {
		closeMenu();

		var dev = DEVICE_LABEL[window.fwPbDevice] || 'Desktop';
		var hidden = hiddenOnCurrent(model);
		var hasOptions = model.view.$el.find('.edit-options').length > 0;
		var $clone = model.view.$el.find('.item-clone, .custom-section-clone, .column-item-clone').first();
		var $del = model.view.$el.find('.item-delete, .custom-section-delete, .column-item-delete').first();
		var $save = model.view.$el.find('.fw-shortcode-section-save, .fw-shortcode-column-save').first();

		var rows = [];
		if (hasOptions) { rows.push({ t: l10n('edit', 'Edit'), fn: function() { trigger(model, '.edit-options'); } }); }
		if ($clone.length) { rows.push({ t: l10n('duplicate', 'Duplicate'), fn: function() { $clone.trigger('click'); } }); }
		rows.push({ sep: 1 });
		rows.push({ t: l10n('copy', 'Copy'), fn: function() { copyModel(model); } });
		rows.push({ t: l10n('paste', 'Paste'), off: !readClipboard(), fn: function() { pasteRelativeTo(model, builder); } });
		rows.push({ t: l10n('copySettings', 'Copy Settings'), fn: function() { copySettings(model); } });
		rows.push({ t: l10n('pasteSettings', 'Paste Settings'), off: !readSettingsClipboard(), fn: function() { pasteSettings(model); } });
		rows.push({ sep: 1 });
		rows.push({ t: (hidden ? l10n('showOn', 'Show on') : l10n('hideOn', 'Hide on')) + ' ' + dev, fn: function() { toggleCurrent(model); } });
		if ($save.length) { rows.push({ t: l10n('saveTemplate', 'Save as Template'), fn: function() { $save.trigger('click'); } }); }
		rows.push({ sep: 1 });
		if ($del.length) { rows.push({ t: l10n('remove', 'Delete'), danger: 1, fn: function() { $del.trigger('click'); } }); }

		$menu = $('<div class="fw-pb-ctxmenu"></div>');
		_.each(rows, function(r) {
			if (r.sep) { $menu.append('<div class="fw-pb-ctxmenu__sep"></div>'); return; }
			var $b = $('<button type="button" class="fw-pb-ctxmenu__item"></button>').text(r.t);
			if (r.danger) { $b.addClass('is-danger'); }
			if (r.off) { $b.addClass('is-disabled'); }
			else {
				$b.on('click', function(e) {
					e.preventDefault();
					e.stopPropagation();
					closeMenu();
					r.fn();
				});
			}
			$menu.append($b);
		});
		$menu.on('mousedown click', function(e) { e.stopPropagation(); });
		$('body').append($menu);

		var mw = $menu.outerWidth(), mh = $menu.outerHeight();
		$menu.css({
			top: Math.max(4, Math.min(y, $(window).height() - mh - 6)) + 'px',
			left: Math.max(4, Math.min(x, $(window).width() - mw - 6)) + 'px'
		});

		setTimeout(function() {
			$(document).on('mousedown.fwPbMenu', function(ev) {
				if (!$(ev.target).closest('.fw-pb-ctxmenu').length) { closeMenu(); }
			});
			$(document).on('keydown.fwPbMenu', function(ev) { if (ev.key === 'Escape') { closeMenu(); } });
			$(window).on('scroll.fwPbMenu resize.fwPbMenu', closeMenu);
		}, 0);
	}

	/* ---- controls + wiring ------------------------------------------------ */

	function calculateSize() {
		$('.fw-option-type-page-builder .builder-root-items .pb-item').each(function() {
			var element = jQuery(this);
			var item = element.closest('.builder-item');
			if (allowed_width < element.width()) {
				item.removeClass(responsive_class).removeClass(display_class);
				return;
			}
			item.addClass(responsive_class);
			item.mouseleave(function() { item.removeClass(display_class); });
		});
	}

	function addControls(data) {
		var model = data.model;
		var builder = data.builder;

		// A single "⋮ More" control opens the full action menu (matches the Live
		// Editor). Copy/Paste/Hide/etc. all live in the menu, keeping the bar slim.
		var $more = $('<i class="fw-shortcode-more dashicons dashicons-ellipsis"></i>')
			.attr('data-hover-tip', l10n('more', 'More'))
			.on('click', function(e) {
				e.stopPropagation();
				e.preventDefault();
				var r = this.getBoundingClientRect();
				openMenu(model, builder, r.left, r.bottom + 2);
			});
		data.$controls.prepend($more);

		registry.push({ model: model, builder: builder });
		refreshDim(model);
	}

	/* ---- events ----------------------------------------------------------- */

	$('.fw-option-type-page-builder input[type=hidden]:first').on('change', calculateSize);
	$(window).resize(calculateSize);

	fwEvents.on('fw-builder:page-builder:items-loaded', function() {
		setTimeout(_.partial(calculateSize), 250);
	});

	// Device switch → re-evaluate every item's dimming for the new breakpoint.
	fwEvents.on('fw:builder:device-preview', function() { refreshAllDims(); });

	fwEvents.on(
		[
			'fw:page-builder:shortcode:item-simple:controls',
			'fw:page-builder:shortcode:section:controls',
			'fw:page-builder:shortcode:column:controls',
			'fw:page-builder:shortcode:innercolumn:controls',
			'fw:page-builder:shortcode:contact-form:controls',
		].join(' '),
		function(data) { addControls(data); }
	);

	// Right-click a builder item → open its action menu (DOM0 property returning
	// false cancels the native menu even when a host plugin forces listeners
	// passive, which would make addEventListener+preventDefault a no-op).
	document.oncontextmenu = function(e) {
		e = e || window.event;
		var t = e.target;
		if (!t || !t.closest || !t.closest('.fw-option-type-page-builder')) { return true; }

		var hit = itemAt(t);
		if (!hit) { return true; }

		openMenu(hit.entry.model, hit.entry.builder, e.clientX, e.clientY);
		if (e.preventDefault) { e.preventDefault(); }
		return false;
	};

	// Track the item under the cursor — the active target for keyboard shortcuts.
	document.addEventListener('mouseover', function(e) {
		var t = e.target;
		hoveredEntry = (t && t.closest && t.closest('.fw-option-type-page-builder')) ? itemAt(t) : null;
	}, true);

	/** Trigger the builder's Undo/Redo control (if present + enabled). The links
	 *  live in the builder's `.history-container` regardless of the option wrapper
	 *  class, so target that. */
	function builderHistory(dir) {
		var $a = $('.history-container a.' + dir).first();
		if ($a.length && !$a.hasClass('disabled')) { $a.trigger('click'); }
	}

	// Keyboard shortcuts. Ctrl+S saves the post; the rest act on the hovered item
	// (the backend has no persistent selection). Skipped while typing in a field.
	document.addEventListener('keydown', function(e) {
		if (!(e.ctrlKey || e.metaKey)) { return; }
		var k = (e.key || '').toLowerCase();
		var t = e.target, tag = t && t.tagName;
		var inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable);

		// Save — works everywhere; blocks the browser's Save-page dialog. Prefer
		// "Save Draft" when it's available so Ctrl+S never accidentally PUBLISHES a
		// draft; fall back to Publish/Update for already-published posts.
		if (k === 's') {
			e.preventDefault();
			var $draft = $('#save-post');
			if ($draft.length && $draft.is(':visible')) { $draft.trigger('click'); }
			else { $('#publish').trigger('click'); }
			return;
		}
		if (inField) { return; }

		// Undo / Redo via the builder's own history control.
		if (k === 'z' && !e.shiftKey) { e.preventDefault(); builderHistory('undo'); return; }
		if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); builderHistory('redo'); return; }

		var entry = hoveredEntry && hoveredEntry.entry;
		if (!entry || !entry.model.view || !document.body.contains(entry.model.view.el)) { return; }

		if (k === 'c' && !(window.getSelection && String(window.getSelection()))) {
			e.preventDefault(); copyModel(entry.model);
		} else if (k === 'v') {
			e.preventDefault(); pasteRelativeTo(entry.model, entry.builder);
		} else if (k === 'd') {
			e.preventDefault(); trigger(entry.model, '.item-clone, .custom-section-clone, .column-item-clone');
		}
	}, false);
})(jQuery, fw_option_type_page_builder_editor_integration_data);
