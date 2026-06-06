<?php if ( ! defined( 'FW' ) ) {
	die( 'Forbidden' );
}

/**
 * Registry of "section-like" page-builder item types.
 *
 * A type is section-like if it behaves as a root-level container holding
 * rows (same hierarchy slot as the built-in `[section]`). Custom shortcodes
 * such as `[hero_section]`, `[parallax_section]`, etc., register themselves
 * here so the existing hardcoded `'section'` checks (allowIncomingType,
 * items corrector root recognition, sort/hierarchy rules) can ask
 * "is this type section-like?" instead of comparing a literal string.
 *
 * The set is filterable via `fw_section_like_types` so third-party themes
 * and plugins can extend it without subclassing.
 */
final class FW_Section_Like_Registry {

	private static $types = array( 'section' );

	public static function register( $type ) {
		if ( ! is_string( $type ) || $type === '' ) {
			return;
		}
		if ( ! in_array( $type, self::$types, true ) ) {
			self::$types[] = $type;
		}
	}

	public static function get_types() {
		return apply_filters( 'fw_section_like_types', self::$types );
	}

	public static function is_section_like( $type ) {
		return in_array( $type, self::get_types(), true );
	}
}
