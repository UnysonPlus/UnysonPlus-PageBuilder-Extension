(function (fwe) {
	/**
	 * Registry of section-like item types, mirroring FW_Section_Like_Registry on
	 * the PHP side. Initialized from `_fw_section_like_types` localized by the
	 * page-builder extension; section-like variants register themselves at runtime.
	 */
	window.fwSectionLikeTypes = window.fwSectionLikeTypes || (function () {
		var initial = (typeof _fw_section_like_types !== 'undefined' && _fw_section_like_types && _fw_section_like_types.types)
			? _fw_section_like_types.types.slice()
			: ['section'];

		return {
			types: initial,
			register: function (type) {
				if (typeof type === 'string' && type && this.types.indexOf(type) === -1) {
					this.types.push(type);
				}
			},
			isSectionLike: function (type) {
				return this.types.indexOf(type) !== -1;
			}
		};
	})();

	/**
	 * Factory that produces a Backbone item view + model pair for a section-like
	 * page-builder item, parameterized by its type string and per-type data global.
	 *
	 * Each section-like variant calls this from inside its
	 * `fw-builder:page-builder:register-items` handler, providing:
	 *   - type:           the type string returned by PHP get_type() (e.g. 'hero_section')
	 *   - dataGlobalName: the window-scope name that wp_localize_script populated
	 *                    with the item data (e.g. 'page_builder_item_type_hero_section_data')
	 *
	 * The factory mirrors the canonical PageBuilderSectionItemView and item class
	 * from shortcodes/section/.../scripts.js but uses fwSectionLikeTypes for the
	 * hierarchy checks so additional variants can be registered later without
	 * editing this code.
	 */
	window.createSectionLikeItem = function (builder, options) {
		var TYPE = options.type;
		var DATA_GLOBAL = options.dataGlobalName;

		var itemData = function () {
			return window[DATA_GLOBAL] || {};
		};

		var triggerEvent = function (itemModel, event, eventData) {
			var name = 'fw:builder-type:{builder-type}:item-type:{item-type}:'
				.replace('{builder-type}', builder.get('type'))
				.replace('{item-type}', itemModel.get('type'))
				+ event;

			var data = {
				modal: itemModel.view ? itemModel.view.modal : null,
				item: itemModel,
				itemView: itemModel.view,
				shortcode: itemModel.get('shortcode'),
				builder: builder
			};

			fwEvents.trigger(name, eventData ? _.extend(eventData, data) : data);
		};

		var getEventName = function (itemModel, event) {
			return 'fw:builder-type:{builder-type}:item-type:{item-type}:'
				.replace('{builder-type}', builder.get('type'))
				.replace('{item-type}', itemModel.get('type'))
				+ event;
		};

		var SectionLikeItemView = builder.classes.ItemView.extend({
			initialize: function (initOptions) {
				this.defaultInitialize();
				this.initOptions = initOptions;
				this.initOptions.templateData = this.initOptions.templateData || {};
			},
			template: _.template(
				'<div class="pb-item-type-column pb-item custom-section">' +
					'<div class="panel fw-row">' +
						'<div class="panel-left fw-col-xs-6">' +
							'<div class="column-title"><%= title %></div>' +
						'</div>' +
						'<div class="panel-right fw-col-xs-6">' +
							'<div class="controls">' +
								'<% if (hasOptions) { %>' +
								'<i class="dashicons dashicons-admin-generic edit-options" data-hover-tip="<%- edit %>"></i>' +
								'<% } %>' +
								'<i class="dashicons dashicons-admin-page custom-section-clone" data-hover-tip="<%- duplicate %>"></i>' +
								'<i class="dashicons dashicons-no custom-section-delete" data-hover-tip="<%- remove %>"></i>' +
								'<i class="dashicons dashicons-arrow-down custom-section-collapse" data-hover-tip="<%- collapse %>"></i>' +
							'</div>' +
						'</div>' +
					'</div>' +
					'<div class="builder-items"></div>' +
				'</div>'
			),
			render: function () {
				var title = this.initOptions.templateData.title;
				var titleTemplate = itemData().title_template;

				if (titleTemplate && this.model.get('atts')) {
					try {
						title = _.template(
							jQuery.trim(titleTemplate),
							undefined,
							{
								evaluate: /\{\{([\s\S]+?)\}\}/g,
								interpolate: /\{\{=([\s\S]+?)\}\}/g,
								escape: /\{\{-([\s\S]+?)\}\}/g
							}
						)({
							o: this.model.get('atts'),
							title: title
						});
					} catch (e) {
						console.error('section-like title_template error', e.message);
						title = _.template('<%= title %>')({title: title});
					}
				} else {
					title = _.template('<%= title %>')({title: title});
				}

				this.defaultRender(jQuery.extend({}, this.initOptions.templateData, {title: title}));

				this.$el[this.model.get('fw-collapse') ? 'addClass' : 'removeClass']('pb-item-section-collapsed');

				// Tag the template root with a per-type class so type-specific
				// editor CSS can target it (e.g. masonry_section renders its child
				// columns as a grid). Also mirror a few layout atts onto the child
				// container as CSS custom properties; only types that define them
				// (masonry_section: cols_lg/md/sm) use them, harmless otherwise.
				var $root = this.$('.custom-section').first();
				if ($root.length) {
					$root.addClass('pb-section-like-' + TYPE);

					var atts = this.model.get('atts') || {};
					var $items = this.$('.builder-items').first();
					if ($items.length) {
						_.each(['lg', 'md', 'sm'], function (bp) {
							var v = atts['cols_' + bp];
							if (v) { $items.css('--mc-' + bp, v); }
						});
					}
				}

				// Reuse the same controls event the canonical section emits, so
				// existing visual-elements / responsive integrations attach to
				// section-like variants too without per-type subscriptions.
				fwEvents.trigger('fw:page-builder:shortcode:section:controls', {
					$controls: this.$('.controls:first'),
					model: this.model,
					builder: builder
				});
			},
			events: {
				'click': 'editOptions',
				'click .edit-options': 'editOptions',
				'click .custom-section-clone': 'cloneItem',
				'click .custom-section-delete': 'removeItem',
				'click .custom-section-collapse': 'collapseItem'
			},
			lazyInitModal: function () {
				this.lazyInitModal = function () {};

				if (_.isEmpty(this.initOptions.modalOptions)) {
					return;
				}

				var eventData = {modalSettings: {buttons: []}};
				triggerEvent(this.model, 'options-modal:settings', eventData);

				this.modal = new fw.OptionsModal({
					title: itemData().title || 'Section',
					options: this.initOptions.modalOptions,
					values: this.model.get('atts'),
					size: this.initOptions.modalSize,
					headerElements: itemData().header_elements
				}, eventData.modalSettings);

				this.listenTo(this.modal, 'change:values', function (modal, values) {
					this.model.set('atts', values);
				});

				this.listenTo(this.modal, {
					'open': function () {
						fwEvents.trigger(getEventName(this.model, 'options-modal:open'), {modal: this.modal, item: this.model, itemView: this});
					},
					'render': function () {
						fwEvents.trigger(getEventName(this.model, 'options-modal:render'), {modal: this.modal, item: this.model, itemView: this});
					},
					'close': function () {
						fwEvents.trigger(getEventName(this.model, 'options-modal:close'), {modal: this.modal, item: this.model, itemView: this});
					},
					'change:values': function () {
						fwEvents.trigger(getEventName(this.model, 'options-modal:change:values'), {modal: this.modal, item: this.model, itemView: this});
					}
				});
			},
			editOptions: function (e) {
				e.stopPropagation();
				this.lazyInitModal();
				if (!this.modal) {
					return;
				}

				var flow = {cancelModalOpening: false};
				fwEvents.trigger('fw:page-builder:shortcode:section:modal:before-open', {
					modal: this.modal,
					model: this.model,
					builder: builder,
					flow: flow
				});

				if (!flow.cancelModalOpening) {
					this.modal.open();
				}
			},
			cloneItem: function (e) {
				e.stopPropagation();
				var index = this.model.collection.indexOf(this.model);
				var attributes = this.model.toJSON();
				var subItems = attributes['_items'];

				delete attributes['_items'];

				var cloned = new SectionLikeItem(attributes);
				triggerEvent(cloned, 'clone-item:before');
				this.model.collection.add(cloned, {at: index + 1});
				cloned.get('_items').reset(subItems);
			},
			removeItem: function (e) {
				e.stopPropagation();
				this.remove();
				this.model.collection.remove(this.model);
			},
			collapseItem: function (e) {
				e.stopPropagation();
				this.model.set('fw-collapse', !this.model.get('fw-collapse'));
			}
		});

		var SectionLikeItem = builder.classes.Item.extend({
			defaults: {
				type: TYPE
			},
			initialize: function () {
				this.view = new SectionLikeItemView({
					id: 'page-builder-item-' + this.cid,
					model: this,
					modalOptions: itemData().options,
					modalSize: itemData().popup_size,
					templateData: {
						hasOptions: !!itemData().options,
						edit: itemData().l10n ? itemData().l10n.edit : '',
						duplicate: itemData().l10n ? itemData().l10n.duplicate : '',
						remove: itemData().l10n ? itemData().l10n.remove : '',
						collapse: itemData().l10n ? itemData().l10n.collapse : '',
						title: itemData().title
					}
				});

				this.defaultInitialize();
			},
			allowIncomingType: function (type) {
				return !window.fwSectionLikeTypes.isSectionLike(type);
			},
			allowDestinationType: function (type) {
				return 'column' !== type;
			}
		});

		window.fwSectionLikeTypes.register(TYPE);

		return SectionLikeItem;
	};
})(fwEvents);
