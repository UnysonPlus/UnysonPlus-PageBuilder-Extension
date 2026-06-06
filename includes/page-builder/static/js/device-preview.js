/**
 * Device preview toggle (Desktop / Tablet / Phone) for the page builder.
 *
 * Adds three toggle buttons to the builder toolbar. The active device drives an
 * `fw-device-{lg|md|sm}` class on the builder root (`.fw-option-type-builder`) and
 * a `window.fwPbDevice` global, then fires `fw:builder:device-preview` and a
 * synthetic window `resize`. Each responsive subsystem keys off those:
 *   - device-preview.css constrains the canvas to a device-width frame
 *   - the column item view re-runs applyLayoutPreview() (per-breakpoint width/offset)
 *   - the masonry editor CSS switches grid-template-columns to --mc-md / --mc-sm
 *     and re-packs on the resize event.
 *
 * Editor-only: nothing here changes the saved shortcode or the live page.
 * Mirrors section-sorter.js's toolbar-injection pattern.
 */
(function ($, fwe, _, localized) {
	'use strict';

	var DEVICES = ['lg', 'md', 'sm'];
	var STORAGE_KEY = 'fw-pb-device';

	function getSaved() {
		try {
			var v = window.localStorage.getItem(STORAGE_KEY);
			return (DEVICES.indexOf(v) !== -1) ? v : 'lg';
		} catch (e) {
			return 'lg';
		}
	}

	function save(device) {
		try {
			window.localStorage.setItem(STORAGE_KEY, device);
		} catch (e) {}
	}

	function fireResize() {
		try {
			window.dispatchEvent(new Event('resize'));
		} catch (e) {
			var ev = document.createEvent('Event');
			ev.initEvent('resize', true, true);
			window.dispatchEvent(ev);
		}
	}

	$(document.body).on('fw:option-type:builder:init', function (e, data) {
		if (!data || !data.builder || data.builder.get('type') !== 'page-builder') {
			return;
		}

		var l10n = (localized && localized.l10n) || {};
		var $builder = data.$headerTools.closest('.fw-option-type-builder');

		var $container = $(
			'<div class="fw-device-preview fw-pull-right">' +
				'<a href="#" class="fw-device-btn" data-device="lg" onclick="return false;" title="' + (l10n.desktop || 'Desktop') + '">' +
					'<span class="dashicons dashicons-desktop"></span>' +
				'</a>' +
				'<a href="#" class="fw-device-btn" data-device="md" onclick="return false;" title="' + (l10n.tablet || 'Tablet') + '">' +
					'<span class="dashicons dashicons-tablet"></span>' +
				'</a>' +
				'<a href="#" class="fw-device-btn" data-device="sm" onclick="return false;" title="' + (l10n.phone || 'Phone') + '">' +
					'<span class="dashicons dashicons-smartphone"></span>' +
				'</a>' +
			'</div>'
		);

		function apply(device) {
			if (DEVICES.indexOf(device) === -1) {
				device = 'lg';
			}
			window.fwPbDevice = device;
			$builder
				.removeClass('fw-device-lg fw-device-md fw-device-sm')
				.addClass('fw-device-' + device);
			$container.find('.fw-device-btn')
				.removeClass('active')
				.filter('[data-device="' + device + '"]').addClass('active');
			save(device);
			fwe.trigger('fw:builder:device-preview', device);
			fireResize();
		}

		_.defer(function () {
			data.$headerTools.removeClass('fw-hidden').append($container);

			$container.on('click', '.fw-device-btn', function (ev) {
				ev.preventDefault();
				apply($(this).attr('data-device'));
			});

			apply(getSaved());
		});
	});
})(jQuery, fwEvents, _, typeof _fw_page_builder_device_preview !== 'undefined' ? _fw_page_builder_device_preview : { l10n: {} });
