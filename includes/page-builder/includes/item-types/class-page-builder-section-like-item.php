<?php if ( ! defined( 'FW' ) ) {
	die( 'Forbidden' );
}

/**
 * Base class for "section-like" page-builder item types.
 *
 * A section-like type behaves identically to the built-in `[section]`:
 * it lives at root, holds rows, and outputs a shortcode tag whose
 * contents are the corrected/rendered rows. Concrete subclasses only
 * need to override `get_type()` (and point `get_shortcode_slug()` at
 * the corresponding FW_Shortcode instance if its name differs from the
 * type string).
 *
 * On construction the subclass:
 *   - registers itself in FW_Section_Like_Registry
 *   - hooks the corrector's `disable-builder-item-correction:{type}` so
 *     the default branch in correct_root_items() doesn't wrap this item
 *     inside an auto-generated [section]
 *   - hooks `manual-builder-item-correction:{type}` so the corrector
 *     still recurses into this item's _items with correct_section(),
 *     keeping inner rows/columns properly wrapped
 *
 * The existing `Page_Builder_Section_Item` is the canonical first member
 * of this family; this base inherits its enqueue/storage/data shape so
 * subclasses share the section view/sortable behavior on the editor side
 * by default.
 */
abstract class Page_Builder_Section_Like_Item extends Page_Builder_Item {

	/**
	 * @internal
	 * Called by FW_Option_Type_Builder_Item::_call_init right after this item
	 * is registered. Can't override __construct — it's final on the framework's
	 * base class. _init is the framework's blessed extension point.
	 */
	public function _init() {
		$type = $this->get_type();

		FW_Section_Like_Registry::register( $type );

		add_filter(
			'fw-ext:page-builder:disable-builder-item-correction:' . $type,
			'__return_true'
		);

		add_filter(
			'fw-ext:page-builder:manual-builder-item-correction:' . $type,
			array( $this, '_manual_correct_section_like' ),
			10,
			3
		);
	}

	/**
	 * @internal
	 * Recurse into this item's _items with the corrector's section logic
	 * so inner rows/columns/simples still get properly wrapped, but the
	 * outer item is left alone (i.e., not wrapped in another section).
	 */
	public function _manual_correct_section_like( $default, $item, $helpers ) {
		if ( isset( $item['_items'] ) && is_array( $item['_items'] ) ) {
			$item['_items'] = call_user_func( $helpers['correct_section'], $item['_items'] );
		}
		return $item;
	}

	/**
	 * Default: use the type string as the shortcode slug for fw_ext('shortcodes')->get_shortcode().
	 * Subclasses can override if their slug differs from their type.
	 */
	protected function get_shortcode_slug() {
		return $this->get_type();
	}

	private function get_shortcode_instance() {
		return fw_ext( 'shortcodes' )->get_shortcode( $this->get_shortcode_slug() );
	}

	private function get_shortcode_options_local() {
		$instance = $this->get_shortcode_instance();
		return $instance ? $instance->get_options() : array();
	}

	private function get_shortcode_config_local() {
		$instance = $this->get_shortcode_instance();
		return $instance ? $instance->get_shortcode_config() : array();
	}

	/**
	 * Overridden so the asset handles/keys are unique per type
	 * (the parent uses 'section' hard-coded paths).
	 */
	public function enqueue_static() {
		$shortcode_instance = $this->get_shortcode_instance();
		if ( ! $shortcode_instance ) {
			return;
		}

		$handle = $this->get_builder_type() . '_item_type_' . $this->get_type();

		$css_path = $shortcode_instance->locate_URI(
			'/includes/page-builder-' . $this->get_type() . '-item/static/css/styles.css'
		);
		if ( $css_path ) {
			wp_enqueue_style(
				$handle,
				$css_path,
				array(),
				fw()->theme->manifest->get_version()
			);
		}

		$js_path = $shortcode_instance->locate_URI(
			'/includes/page-builder-' . $this->get_type() . '-item/static/js/scripts.js'
		);
		if ( $js_path ) {
			wp_enqueue_script(
				$handle,
				$js_path,
				array( 'fw-events', 'underscore', 'fw-section-like-factory' ),
				fw()->theme->manifest->get_version(),
				true
			);

			wp_localize_script(
				$handle,
				str_replace( '-', '_', $handle . '_data' ),
				$shortcode_instance->get_item_data()
			);
		}
	}

	protected function get_thumbnails_data() {
		return array( $this->get_shortcode_config_local() );
	}

	public function get_value_from_attributes( $attributes ) {
		$attributes['type'] = $this->get_type();

		$options = $this->get_shortcode_options_local();
		if ( ! empty( $options ) ) {
			if ( empty( $attributes['atts'] ) ) {
				$attributes['atts'] = fw_get_options_values_from_input( $options, array() );
			} else {
				$options = fw_extract_only_options( $options );
				foreach ( $attributes['atts'] as $option_id => $option_value ) {
					if ( isset( $options[ $option_id ] ) ) {
						$options[ $option_id ]['value'] = $option_value;
					}
				}
				$attributes['atts'] = fw_get_options_values_from_input( $options, array() );
			}
		}

		return $attributes;
	}

	public function get_shortcode_data( $atts = array() ) {
		$return = array(
			'tag' => $this->get_type(),
		);
		if ( isset( $atts['atts'] ) ) {
			$return['atts'] = $atts['atts'];
		}
		return $return;
	}
}
