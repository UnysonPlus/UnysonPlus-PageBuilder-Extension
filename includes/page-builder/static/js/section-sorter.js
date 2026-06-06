(function ($, fwe, _, localized) {
	$(document.body).on('fw:option-type:builder:init', function (e, data) {
		if (!data || !data.builder || data.builder.get('type') !== 'page-builder') {
			return;
		}

		var l10n = (localized && localized.l10n) || {};
		var rootItems = data.builder.rootItems;
		var isOpen = false;
		var isDirty = true;

		var inst = {
			$el: {
				headerTools: data.$headerTools,
				container: $(
					'<div class="section-sorter-container fw-pull-right">' +
						'<a class="section-sorter-btn" href="#" onclick="return false;">' +
							escapeHtml(l10n.btn || 'Sort Sections') +
						'</a>' +
					'</div>'
				),
				tooltipContent: $(
					'<div class="fw-section-sorter-tooltip-content">' +
						'<ul class="section-sorter-list"></ul>' +
						'<div class="section-sorter-empty fw-hidden">' +
							escapeHtml(l10n.empty || 'No sections yet') +
						'</div>' +
					'</div>'
				)
			},
			tooltipApi: null
		};

		_.defer(function () {
			inst.$el.headerTools
				.removeClass('fw-hidden')
				.append(inst.$el.container);

			inst.tooltipApi = inst.$el.container
				.find('.section-sorter-btn')
				.qtip({
					show: 'click',
					hide: 'unfocus',
					position: {
						at: 'bottom center',
						my: 'top center',
						viewport: $(document.body)
					},
					events: {
						show: function () {
							isOpen = true;
							if (isDirty) {
								renderList();
							}
						},
						hide: function () {
							isOpen = false;
						}
					},
					style: {
						classes: 'qtip-fw qtip-fw-builder qtip-fw-section-sorter',
						tip: {
							width: 12,
							height: 5
						},
						width: 280
					},
					content: {
						text: inst.$el.tooltipContent
					}
				})
				.qtip('api');

			bindRowEvents();
			initSortable();
			bindCollectionEvents();
		});

		function escapeHtml(str) {
			return String(str == null ? '' : str)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');
		}

		function getLabel(model, index) {
			var atts = model.get('atts') || {};
			var cssId = (atts.css_id || '').toString().trim();
			if (cssId) {
				return cssId;
			}

			// Use the section's visible type label rendered in the canvas
			// (e.g. "Section", "Hero Section", "Custom Section") so additional
			// section-like variants registered through `fwSectionLikeTypes`
			// appear in the sorter with their own name automatically. The
			// `.column-title` element is the title slot used by every section
			// item template (canonical `page-builder-section-item` and the
			// shared `section-like-factory` template both render their title
			// into `.column-title`). Falls back to the localized default if
			// the view isn't ready yet or the type doesn't follow the
			// template convention.
			var typeLabel = '';
			if (model.view && model.view.$el) {
				typeLabel = $.trim(model.view.$el.find('.column-title').first().text());
			}
			if (!typeLabel) {
				typeLabel = l10n.sectionLabel || 'Section';
			}

			return typeLabel + ' ' + (index + 1);
		}

		function renderList() {
			isDirty = false;

			var $list = inst.$el.tooltipContent.find('.section-sorter-list');
			var $empty = inst.$el.tooltipContent.find('.section-sorter-empty');

			$list.empty();

			if (!rootItems.length) {
				$list.addClass('fw-hidden');
				$empty.removeClass('fw-hidden');
				return;
			}

			$list.removeClass('fw-hidden');
			$empty.addClass('fw-hidden');

			// Count only section-like items so a non-section root item (if
			// the items-corrector ever leaves one there) doesn't skip a
			// number in the rendered list — the displayed index always
			// matches the rendered position.
			var visibleIndex = 0;

			rootItems.each(function (model) {
				var modelType = model.get('type');
				var isSectionLike = window.fwSectionLikeTypes
					&& typeof window.fwSectionLikeTypes.isSectionLike === 'function'
					? window.fwSectionLikeTypes.isSectionLike(modelType)
					: modelType === 'section';
				if (!isSectionLike) {
					return;
				}

				var label = getLabel(model, visibleIndex);
				var collapsed = !!model.get('fw-collapse');
				var collapseIcon = collapsed ? 'dashicons-arrow-up' : 'dashicons-arrow-down';
				var collapseTitle = collapsed
					? (l10n.expand || 'Expand')
					: (l10n.collapse || 'Collapse');

				var $row = $(
					'<li class="section-sorter-item" data-cid="' + escapeHtml(model.cid) + '">' +
						'<i class="section-sorter-handle dashicons dashicons-menu" title="' + escapeHtml(l10n.scrollTo || '') + '"></i>' +
						'<span class="section-sorter-index">' + (visibleIndex + 1) + '.</span>' +
						'<span class="section-sorter-label" title="' + escapeHtml(l10n.scrollTo || 'Scroll to this section') + '">' +
							escapeHtml(label) +
						'</span>' +
						'<i class="section-sorter-collapse dashicons ' + collapseIcon + '" title="' + escapeHtml(collapseTitle) + '"></i>' +
					'</li>'
				);

				$list.append($row);

				visibleIndex++;
			});
		}

		function initSortable() {
			inst.$el.tooltipContent.find('.section-sorter-list').sortable({
				axis: 'y',
				handle: '.section-sorter-handle',
				placeholder: 'section-sorter-placeholder',
				forcePlaceholderSize: true,
				tolerance: 'pointer',
				update: function () {
					var orderedCids = $(this)
						.find('> .section-sorter-item')
						.map(function () {
							return $(this).attr('data-cid');
						})
						.get();

					applyReorder(orderedCids);
					refreshIndices();
				}
			});
		}

		function applyReorder(orderedCids) {
			var $canvas = rootItems.view.$el;

			// 1. Move canvas DOM nodes to match new order.
			orderedCids.forEach(function (cid) {
				var model = rootItems.get(cid);
				if (model && model.view && model.view.$el) {
					$canvas.append(model.view.$el);
				}
			});

			// 2. Sync Backbone collection order silently.
			// Mirrors the pattern in builder.js (update handler) so we don't
			// trigger a full ItemsView re-render on every move.
			orderedCids.forEach(function (cid, i) {
				var model = rootItems.get(cid);
				if (!model) {
					return;
				}
				rootItems.remove(model, { silent: true });
				rootItems.add(model, { at: i, silent: true });
			});

			// 3. Single notification for input serialization + undo/redo.
			rootItems.trigger('builder:change');
		}

		function refreshIndices() {
			inst.$el.tooltipContent
				.find('.section-sorter-list > .section-sorter-item')
				.each(function (i) {
					var $row = $(this);
					$row.find('.section-sorter-index').text((i + 1) + '.');

					var cid = $row.attr('data-cid');
					var model = rootItems.get(cid);
					if (model) {
						$row.find('.section-sorter-label').text(getLabel(model, i));
					}
				});
		}

		function bindRowEvents() {
			inst.$el.tooltipContent
				.on('click', '.section-sorter-collapse', function (ev) {
					ev.stopPropagation();

					var $row = $(this).closest('.section-sorter-item');
					var model = rootItems.get($row.attr('data-cid'));
					if (!model) {
						return;
					}

					var next = !model.get('fw-collapse');
					model.set('fw-collapse', next);

					$(this)
						.toggleClass('dashicons-arrow-down', !next)
						.toggleClass('dashicons-arrow-up', next)
						.attr('title', next
							? (l10n.expand || 'Expand')
							: (l10n.collapse || 'Collapse'));
				})
				.on('click', '.section-sorter-label, .section-sorter-index', function (ev) {
					ev.stopPropagation();

					var $row = $(this).closest('.section-sorter-item');
					var model = rootItems.get($row.attr('data-cid'));
					if (!model || !model.view || !model.view.$el) {
						return;
					}

					if (inst.tooltipApi) {
						inst.tooltipApi.hide();
					}

					var el = model.view.$el[0];
					if (el && typeof el.scrollIntoView === 'function') {
						el.scrollIntoView({ behavior: 'smooth', block: 'start' });
					}

					model.view.$el
						.removeClass('section-sorter-highlight');

					// Force reflow so the animation re-triggers if applied twice in a row.
					void model.view.$el[0].offsetWidth;

					model.view.$el.addClass('section-sorter-highlight');
					setTimeout(function () {
						model.view.$el.removeClass('section-sorter-highlight');
					}, 1500);
				});
		}

		function bindCollectionEvents() {
			rootItems.on('add remove reset', function () {
				if (isOpen) {
					renderList();
				} else {
					isDirty = true;
				}
			});

			rootItems.on('change:atts', function () {
				if (isOpen) {
					refreshIndices();
				} else {
					isDirty = true;
				}
			});

			rootItems.on('change:fw-collapse', function (model) {
				if (!isOpen) {
					isDirty = true;
					return;
				}

				var collapsed = !!model.get('fw-collapse');
				var $icon = inst.$el.tooltipContent
					.find('.section-sorter-item[data-cid="' + model.cid + '"] .section-sorter-collapse');

				$icon
					.toggleClass('dashicons-arrow-down', !collapsed)
					.toggleClass('dashicons-arrow-up', collapsed)
					.attr('title', collapsed
						? (l10n.expand || 'Expand')
						: (l10n.collapse || 'Collapse'));
			});

			// Canvas drag may reorder items without firing add/remove (silent).
			// builder:change is the universal "something changed" signal.
			rootItems.on('builder:change', function () {
				if (isOpen) {
					renderList();
				} else {
					isDirty = true;
				}
			});
		}
	});
})(jQuery, fwEvents, _, typeof _fw_page_builder_section_sorter !== 'undefined' ? _fw_page_builder_section_sorter : { l10n: {} });
