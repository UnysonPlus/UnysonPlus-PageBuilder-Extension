<?php if ( ! defined( 'FW' ) ) {
	die( 'Forbidden' );
}

/**
 * Class FW_Extension_Page_Editor
 *
 * Makes UnysonPlus self-sufficient: it turns the WordPress block editor (Gutenberg) OFF and
 * serves WordPress's built-in classic full-width `post.php` edit screen instead — for EVERY
 * post type by default. That is where the Page Builder mounts (`edit_form_after_editor`), so
 * the builder needs no Classic Editor plugin, and the user never leaves the normal WP
 * dashboard: the left admin menu, the Publish box, and every other plugin's meta boxes (All in
 * One SEO, Yoast, …) all stay.
 *
 * There is NO copied Classic-Editor-plugin code here. The classic editor lives in WordPress
 * CORE (it was never removed when Gutenberg arrived in 5.0); this extension just flips the core
 * `use_block_editor_for_post_type` filter to false — exactly the one thing the Classic Editor
 * plugin does. So the screen looks classic because it IS WordPress's own classic editor.
 *
 * Opt-out: post types checked in the Page Builder settings ("Keep the block editor for") keep
 * Gutenberg — e.g. blog Posts, if the user writes them in the block editor. Block-editor-only
 * internal types (reusable blocks, FSE templates) are never touched.
 *
 * Hidden child of the Page Builder: active exactly when the builder is; disable the builder and
 * the block editor returns.
 */
class FW_Extension_Page_Editor extends FW_Extension {

	/** WordPress internal post types that ONLY work in the block editor — never force classic. */
	private function block_only_types() {
		return array( 'wp_block', 'wp_template', 'wp_template_part', 'wp_navigation', 'wp_global_styles' );
	}

	/**
	 * @internal
	 */
	protected function _init() {
		// WP 5.0+ chooses the editor for a post type through this filter. Late priority (100)
		// so we have the final say over plugins that may opt a post type into the block editor.
		add_filter( 'use_block_editor_for_post_type', array( $this, '_filter_use_block_editor_for_post_type' ), 100, 2 );
	}

	/**
	 * Post types the user opted to KEEP on the block editor (from Page Builder settings), as a
	 * flat list of post-type names.
	 *
	 * @return string[]
	 */
	private function kept_on_block() {
		$val = function_exists( 'fw_get_db_ext_settings_option' )
			? fw_get_db_ext_settings_option( 'page-builder', 'page_editor_keep_block', array() )
			: array();

		if ( ! is_array( $val ) ) {
			return array();
		}

		// `checkboxes` stores { post_type => true/false }; keep the truthy keys.
		return array_keys( array_filter( $val ) );
	}

	/**
	 * Force the classic editor for every post type, except (a) block-editor-only internal types
	 * and (b) post types the user opted out via settings — those keep whatever editor they had.
	 *
	 * @param bool   $use_block_editor
	 * @param string $post_type
	 * @return bool
	 * @internal
	 */
	public function _filter_use_block_editor_for_post_type( $use_block_editor, $post_type ) {
		if ( in_array( $post_type, $this->block_only_types(), true ) ) {
			return $use_block_editor; // never touch reusable blocks / FSE templates
		}

		if ( in_array( $post_type, $this->kept_on_block(), true ) ) {
			return $use_block_editor; // user opted this type out -> keep the block editor
		}

		return false; // classic editor
	}
}
