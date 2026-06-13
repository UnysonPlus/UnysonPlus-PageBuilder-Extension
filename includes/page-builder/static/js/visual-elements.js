(function($, itemData) {
	var visibleIcon = 'dashicons-visibility',
		hiddenIcon = 'dashicons-hidden';

	var responsive_class = 'fw-responsive-controls',
		display_class = 'fw-display-controls',
		allowed_width = 280;

	// The builder's device-preview toggle (device-preview.js) exposes the active
	// device as window.fwPbDevice (lg|md|sm) and fires 'fw:builder:device-preview'.
	// The eye hides/shows for whichever device is being previewed — the SAME
	// responsive_hide ("Hide on") data the Live Editor's eye and the Advanced-tab
	// checkboxes drive, so backend, Live Editor and the option modal stay in sync.
	var DEVICE_HIDE = { lg: 'hide-md', md: 'hide-sm', sm: 'hide-xs' };

	// Live registry of every item's eye, so a device-preview switch can re-sync the
	// icons + dimming. Stale entries (deleted items) are pruned on each pass.
	var eyes = [];

	$('.fw-option-type-page-builder input[type=hidden]:first').on(
		'change',
		calculateSize
	);

	$(window).resize(calculateSize);

	/**
	 * Add responsive-class if width is less than allowed.
	 */
	function calculateSize() {
		$(
			'.fw-option-type-page-builder .builder-root-items .pb-item'
		).each(function() {
			var element = jQuery(this);
			var item = element.closest('.builder-item');

			if (allowed_width < element.width()) {
				item.removeClass(responsive_class);
				item.removeClass(display_class);

				return;
			}

			item.addClass(responsive_class);

			item.mouseleave(function() {
				item.removeClass(display_class);
			});
		});
	}

	/** The responsive_hide key for the device currently previewed. */
	function currentHideClass() {
		return DEVICE_HIDE[window.fwPbDevice] || DEVICE_HIDE.lg;
	}

	/**
	 * The item's responsive_hide map ({ 'hide-md': true, … }) as a real object.
	 * Its empty default can arrive as a JS array ([]) — writing a string key to
	 * an array is silently lost on serialize — so normalise to a plain object.
	 * @param {Object} model
	 * @returns {Object}
	 */
	function getResponsiveHide(model) {
		var atts = model.get('atts') || {};
		var rh = atts.responsive_hide;
		return (rh && !_.isArray(rh) && _.isObject(rh)) ? rh : {};
	}

	/** Is the item hidden on the currently previewed device? */
	function hiddenOnCurrent(model) {
		return !!getResponsiveHide(model)[currentHideClass()];
	}

	/**
	 * Toggle the previewed device's hide flag in the model's responsive_hide option.
	 * @param {Object} model
	 */
	function toggleCurrent(model) {
		var cls = currentHideClass();
		var atts = _.clone(model.get('atts') || {});
		var rh = _.clone(getResponsiveHide(model));

		if (rh[cls]) {
			delete rh[cls];
		} else {
			rh[cls] = true;
		}

		atts.responsive_hide = rh;
		model.set('atts', atts); // Backbone change → builder marks dirty + persists

		// The item caches its options modal (lazyInitModal builds it once and
		// reuses it), and the modal re-renders from its own stored `values` on each
		// open. Without syncing those, the Advanced-tab "Hide on" shows stale state
		// for any item whose modal was already opened before the eye was clicked.
		var modal = model.view && model.view.modal;
		if (modal && _.isFunction(modal.set)) {
			modal.set('values', _.clone(atts), { silent: true });
		}
	}

	/**
	 * Sync one eye icon + its builder item's dimming with the previewed device.
	 * @param {Object} model
	 * @param {jQuery} $eye
	 */
	function refreshEye(model, $eye) {
		var hidden = hiddenOnCurrent(model);

		$eye
			.toggleClass(visibleIcon, !hidden)
			.toggleClass(hiddenIcon, hidden);

		if (model.view && model.view.$el) {
			model.view.$el.toggleClass('fw-visibility-off', hidden);
		}
	}

	/** Re-sync every registered eye for the current device (prunes stale items). */
	function refreshAll() {
		eyes = _.filter(eyes, function(entry) {
			if (!entry.$eye.closest('body').length) {
				return false; // item removed from the builder
			}
			refreshEye(entry.model, entry.$eye);
			return true;
		});
	}

	/**
	 * Add the device-aware visibility eye (+ the display-controls button) to an item.
	 * @param {Object} data  { $controls, model, builder }
	 */
	function addIcon(data) {
		var model = data.model;

		var $eye = $('<i class="fw-shortcode-visibility dashicons dashicons-visibility"></i>')
			.attr('data-hover-tip', itemData.l10n.eye)
			.on('click', function(e) {
				e.stopPropagation();
				e.preventDefault();
				toggleCurrent(model);
				refreshEye(model, $eye);
			});

		data.$controls.prepend($eye);
		eyes.push({ model: model, $eye: $eye });

		// The display-controls button (unchanged): reveals overflowing controls on
		// narrow items.
		data.$controls.append(
			$('<i class="fw-responsive-button dashicons dashicons-menu"></i>')
				.attr('data-hover-tip', itemData.l10n.responsive)
				.on('click', function(e) {
					e.stopPropagation();
					e.preventDefault();
					jQuery(this).closest('.builder-item').addClass(display_class);
				})
		);

		refreshEye(model, $eye);
	}

	fwEvents.on('fw-builder:page-builder:items-loaded', function() {
		setTimeout(_.partial(calculateSize), 250);
	});

	// Switching the device-preview re-evaluates every item's hidden state.
	fwEvents.on('fw:builder:device-preview', function() {
		refreshAll();
	});

	fwEvents.on(
		[
			'fw:page-builder:shortcode:item-simple:controls',
			'fw:page-builder:shortcode:section:controls',
			'fw:page-builder:shortcode:column:controls',
			'fw:page-builder:shortcode:innercolumn:controls',
			'fw:page-builder:shortcode:contact-form:controls',
		].join(' '),
		function(data) {
			addIcon(data);
		}
	);
})(jQuery, fw_option_type_page_builder_editor_integration_data);
