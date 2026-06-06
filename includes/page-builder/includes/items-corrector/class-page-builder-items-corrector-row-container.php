<?php if (!defined('FW')) die('Forbidden');

/**
 * Acts like a virtual row container, takes a string representation
 * of a column width like '1_3' or '1_4' and accumulates it
 * it is used by the items corrector when transforming page builder items
 * into properly wrapped ones (columns are put into rows where needed, rows into section, etc.).
 * It is used to determine whether a column fits into a row, or should it start a new one
 */
class _Page_Builder_Items_Corrector_Row_Container
{
	private $accumulator;

	public function __construct()
	{
		$this->accumulator = new _Page_Builder_Items_Corrector_Fraction(0, 1);
	}

	public function add_column($column_width)
	{
		if ($this->column_fits($column_width)) {
			$column_as_fraction = $this->extract_fraction_from_column_width($column_width);
			$this->accumulator->add($column_as_fraction);
			return true;
		}
		return false;
	}

	/**
	 * @param $column_width A string representation of the width e.g.: '1_1', '1_3', '3_4'
	 * @return _Page_Builder_Items_Corrector_Fraction The fraction representation
	 */
	private function extract_fraction_from_column_width($column_width)
	{
		// Non-fraction column keys (e.g. 'col' — the BS5 auto-flex column —
		// or any custom key the user/theme registered without an N_M shape)
		// contribute zero to the row's fill accumulator. Auto-flex columns
		// squeeze into whatever leftover space exists in the row, so they
		// always "fit" and never wrap. Returning 0/1 makes column_fits() and
		// the accumulator math work without parsing the key.
		//
		// Casting fraction parts to (int) is also defensive — the previous
		// code passed raw strings into the Fraction class, which produced a
		// fatal `int * string` if any malformed key slipped through.
		$parts = explode( '_', str_replace( '-', '_', (string) $column_width ) );
		if ( count( $parts ) < 2 || ! is_numeric( $parts[0] ) || ! is_numeric( $parts[1] ) ) {
			return new _Page_Builder_Items_Corrector_Fraction( 0, 1 );
		}

		return new _Page_Builder_Items_Corrector_Fraction( (int) $parts[0], (int) $parts[1] );
	}

	private function column_fits($column_width)
	{
		// 1. Developer-only static config flag (kept for back-compat with any
		//    custom theme that already sets it). `true` disables auto-split.
		if ( fw_ext( 'page-builder' )->get_config( 'disable_columns_auto_wrap' ) ) {
			return true;
		}

		// 2. Page Builder Settings → "Bootstrap 3 Legacy Mode" checkbox.
		//    UNCHECKED (default) = Bootstrap 5 flex-wrap behaviour, no auto-split:
		//    all columns of a section stay in one .fw-row and flex-wrap handles
		//    the visual wrapping, which is what makes Theme Settings → Default
		//    Gap Y take effect between wrapped sub-rows.
		//    CHECKED = legacy Bootstrap 3 behaviour: loads bootstrap-3-legacy.css
		//    AND auto-splits columns into separate .fw-rows when total width
		//    exceeds one row. The two behaviours go together — anyone running
		//    pre-migrated Unyson content needs both to keep their layouts intact.
		if ( function_exists( 'fw_get_db_ext_settings_option' ) ) {
			$legacy = fw_get_db_ext_settings_option( 'page-builder', 'load_bootstrap_3_legacy_css', false );
			// FW checkbox storage has been seen returning bool / '1' / '0' / int
			// across versions — normalise to a strict "off" check covering each.
			if ( $legacy === false || $legacy === '' || $legacy === '0' || $legacy === 0 ) {
				return true;
			}
		}

		// 3. Original fraction-based split logic — only reaches here when both
		//    opt-outs above pass, i.e. legacy mode is explicitly enabled.
		$column_as_fraction = $this->extract_fraction_from_column_width( $column_width );
		$column_as_fraction->add( $this->accumulator );

		return $column_as_fraction->to_number() <= 1;
	}

	public function empty_container()
	{
		$this->accumulator->set_numerator(0);
		$this->accumulator->set_denominator(1);
	}
}

