<?php if ( ! defined( 'FW' ) ) {
	die( 'Forbidden' );
}

/**
 * Call add_post_type_support('{post-type}', 'fw-page-builder')
 * for post types checked on Page Builder Settings page.
 */
function _action_fw_ext_page_builder_add_support() {
	$feature_name = fw_ext('page-builder')->get_supports_feature_name();

	foreach (
		array_keys(fw_get_db_ext_settings_option('page-builder', 'post_types'))
		as $slug
	) {
		add_post_type_support($slug, $feature_name);
	}
}
add_action( 'init', '_action_fw_ext_page_builder_add_support',
	/**
	 * Call this as late as possible to make sure all post types were registered.
	 *
	 * Calling this earlier, will cause some post types to not appear in the checkboxes list on Page Builder Settings page.
	 * That happens when fw_get_db_ext_settings_option('page-builder', ...) is called,
	 * there are no values in db and settings options are extracted from settings options array.
	 * In settings options is used fw_ext_page_builder_get_supported_post_types() which returns the registered post types,
	 * and because it will be called earlier than other post types has been registered,
	 * those post types will not be available.
	 */
	9999
);

function _action_fw_ext_page_builder_register_option_storage_types(_FW_Option_Storage_Type_Register $register) {
	$register->register(new FW_Option_Storage_Type_Post_Meta_Page_Builder());
}
add_action('fw:option-storage-types:register', '_action_fw_ext_page_builder_register_option_storage_types');

function _action_fw_ext_page_builder_register_simple_item_type() {
	FW_Option_Type_Builder::register_item_type('Page_Builder_Simple_Item');
}

add_action( 'fw_option_type_builder:page-builder:register_items', '_action_fw_ext_page_builder_register_simple_item_type' );

/**
 * Make the Unyson+ Builder the DEFAULT editor for NEW Pages and custom post types.
 *
 * The page-builder option hard-codes its default value to builder_active => false, so a
 * brand-new post otherwise opens in the Classic editor. We flip that default to `true`
 * for every builder-supported post type EXCEPT blog `post`, which keeps the Classic
 * editor by default (the "Unyson+ Builder" button is still there to switch it on).
 *
 * Only the DEFAULT value changes, so this affects NEW content only: a post that already
 * has saved builder meta loads its stored builder_active over this default (the option's
 * _render reads the current value, which is saved-meta-over-default), so existing
 * pages/posts are never forced into or out of the builder. Both toggle buttons
 * ("Default Editor" / "Unyson+ Builder") stay intact, so any post can still be switched
 * either way at any time.
 *
 * The per-type rule is filterable via `fw_page_builder_default_active_for_post_type` so a
 * site can opt a specific CPT out (e.g. WooCommerce `product`) without touching this code.
 *
 * Mirrors the theme-builder's proven fw_post_options approach; priority 20 runs after the
 * page builder registers its box at 10.
 *
 * @param array  $options   The post's fw options (by box).
 * @param string $post_type Current post type being edited.
 * @return array
 */
function _filter_fw_page_builder_default_active_for_new( $options, $post_type ) {
	// Blog posts keep the Classic editor by default (builder still available via the button).
	$default_active = ( 'post' !== $post_type );

	/** Filters whether a NEW post of this type opens with the Unyson+ Builder active by default. */
	if ( ! apply_filters( 'fw_page_builder_default_active_for_post_type', $default_active, $post_type ) ) {
		return $options;
	}

	if ( isset( $options['page-builder-box']['options']['page-builder'] ) ) {
		$value = ( isset( $options['page-builder-box']['options']['page-builder']['value'] )
			&& is_array( $options['page-builder-box']['options']['page-builder']['value'] ) )
			? $options['page-builder-box']['options']['page-builder']['value']
			: array( 'json' => '[]' );
		$value['builder_active'] = true;
		$options['page-builder-box']['options']['page-builder']['value'] = $value;
	}

	return $options;
}
add_filter( 'fw_post_options', '_filter_fw_page_builder_default_active_for_new', 20, 2 );

/**
 * On the Page Builder Settings screen, show the ALWAYS-ON post types (Snippets,
 * Header/Footer/Body presets) as pre-checked and disabled in the "Activate for" list.
 *
 * Those types get builder support forced in code by their own extensions, so their
 * checkboxes were misleading — unchecking one did nothing. We lock them checked+disabled
 * and tag them "always on" so the UI reflects reality. The render hook fires before the
 * options HTML, so the script defers to DOM-ready. Presentation only — no saved value
 * depends on it (support is added by the forcing extensions regardless).
 *
 * @internal
 */
function _action_fw_page_builder_lock_always_on_settings_ui() {
	$always_on = function_exists( 'fw_ext_page_builder_always_on_post_types' )
		? fw_ext_page_builder_always_on_post_types()
		: array();

	if ( empty( $always_on ) ) {
		return;
	}
	?>
<style>
.fw-page-builder-always-on-note{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:9px;font-size:11px;font-weight:600;line-height:16px;background:#e5eff7;color:#01729c;vertical-align:middle;}
label.fw-page-builder-always-on{opacity:1;cursor:default;}
label.fw-page-builder-always-on input[type="checkbox"]{cursor:default;}
</style>
<script>
(function(){
	var slugs = <?php echo wp_json_encode( array_values( $always_on ) ); ?>;
	function lock(){
		var done = 0;
		slugs.forEach(function(slug){
			var box = document.querySelector('input[type="checkbox"][data-fw-checkbox-id="' + slug + '"]');
			if(!box){ return; }
			box.checked = true;
			box.disabled = true;
			var label = box.closest('label');
			if(label && !label.classList.contains('fw-page-builder-always-on')){
				label.classList.add('fw-page-builder-always-on');
				var tag = document.createElement('span');
				tag.className = 'fw-page-builder-always-on-note';
				tag.textContent = '<?php echo esc_js( __( 'always on', 'fw' ) ); ?>';
				label.appendChild(tag);
			}
			done++;
		});
		return done === slugs.length;
	}
	var tries = 0;
	function tick(){ if(lock() || ++tries > 40){ return; } setTimeout(tick, 150); }
	if(document.readyState === 'loading'){
		document.addEventListener('DOMContentLoaded', tick);
	} else {
		tick();
	}
})();
</script>
	<?php
}
add_action( 'fw_extension_settings_form_render:page-builder', '_action_fw_page_builder_lock_always_on_settings_ui' );