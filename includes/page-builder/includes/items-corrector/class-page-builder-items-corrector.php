<?php if (!defined('FW')) die('Forbidden');

class _Page_Builder_Items_Corrector
{
	private $row_container;

	private $column_wrap ;
	private $row_wrap;
	private $section_wrap;

	private $items;

	public function __construct($item_types)
	{
		$this->row_container = new _Page_Builder_Items_Corrector_Row_Container();

		$this->column_wrap  = $item_types['column']->get_value_from_attributes(array(
			'_items' => array()
		));
		$this->row_wrap     = $item_types['row']->get_value_from_attributes(array(
			'_items' => array()
		));
		$this->section_wrap = $item_types['section']->get_value_from_attributes(array(
			'_items' => array()
		));
	}

	public function wrap_into_column($items, $data = array())
	{
		$wrapper = $this->column_wrap;
		$wrapper['_items'] = $items;

		return $wrapper;
	}

	public function wrap_into_row($items, $data = array())
	{
		$wrapper = $this->row_wrap;
		$wrapper['_items'] = $items;
		return $wrapper;
	}

	public function wrap_into_section($items, $data = array())
	{
		$wrapper = $this->section_wrap;
		$wrapper['_items'] = $items;

		if (isset($data['atts']) && is_array($data['atts'])) {
			$wrapper['atts'] = array_merge($wrapper['atts'], $data['atts']);
		}

		return $wrapper;
	}

	public function correct($items)
	{
		$this->items = $items;
		$this->correct_sections();
		$this->correct_root_items();

		return apply_filters('fw_ext_page-builder_items_correction_complete', $this->items,
			$this,
			$items // @since 1.3.9
		);
	}

	private function correct_sections()
	{
		foreach ($this->items as $index => &$item) {
			if (FW_Section_Like_Registry::is_section_like($item['type'])) {
				$item['atts']['auto_generated'] = false;
				if ($index === 0) {
					$item['atts']['first_in_builder'] = true;
				}

				$item['_items'] = $this->correct_section($item['_items']);
			}
		}
	}

	public function correct_section($section)
	{
		/**
		 * @var FW_Extension_Shortcodes $shortcodes_extension
		 */
		$shortcodes_extension = fw_ext('shortcodes');

		/**
		 * Nested columns (one+ level): before the row-grouping loop runs, give
		 * every column its own inner row(s) when it contains child columns. This
		 * recurses through correct_section(), so a column-in-column gets the exact
		 * same "group columns into a .fw-row" treatment a section gets. Columns
		 * with no child columns are returned untouched (today's behavior — their
		 * simple items render directly inside the column).
		 *
		 * IMPORTANT (re-entrancy): correct_section() now uses a LOCAL row
		 * container (below) instead of the shared $this->row_container, so the
		 * recursive call for a column's contents can't clobber the width-fitting
		 * state of the loop that's iterating this section's own columns.
		 */
		foreach ( $section as $k => $it ) {
			if ( isset( $it['type'] ) && $it['type'] === 'column' ) {
				$section[ $k ] = $this->correct_nested_columns( $it );
			}
		}

		// Local, per-call row container — safe under the recursion above.
		$row_container = new _Page_Builder_Items_Corrector_Row_Container();

		$fixed_section = array();
		for ($i = 0, $count = count($section); $i < $count; $i++) {
			switch ($section[$i]['type']) {
				case 'column':
					if (
						($shortcode_instance = $shortcodes_extension->get_shortcode('column'))
						&&
						$shortcode_instance->get_config('page_builder/disable_correction')
					) {
						$columns = array( $section[ $i ] );
						while ( isset( $section[ $i + 1 ] ) && $section[ $i + 1 ]['type'] === 'column' ) {
							$columns[] = $section[ ++$i ];
						}
						$fixed_section[] = $this->wrap_into_row( $columns );
					} else {
						$row_container->empty_container();
						$columns = array();

						do {
							if ( $row_container->add_column(
								apply_filters('fw:ext:page-builder:item-corrector:column-width', $section[ $i ]['width'], $section[ $i ])
							) ) {
								$columns[] = $section[ $i ];
							} else {
								$fixed_section[] = $this->wrap_into_row( $columns );

								$columns = array( $section[ $i ] );
								$row_container->empty_container();
								$row_container->add_column( $section[ $i ]['width'] );
							}
						} while ( isset( $section[ $i + 1 ] ) && $section[ $i + 1 ]['type'] === 'column' && ++$i );

						$fixed_section[] = $this->wrap_into_row( $columns );
					}
					break;

				case 'simple':
					if (
						($shortcode_instance = $shortcodes_extension->get_shortcode($section[$i]['shortcode']))
						&&
						$shortcode_instance->get_config('page_builder/disable_correction')
					) {
						$fixed_section[] = $section[$i];
					} else {
						$fixed_section[] = $this->wrap_into_row(
							array(
								$this->wrap_into_column(
									array( $section[ $i ] )
								)
							)
						);
					}
					break;

				// Page Builder custom item types
				default:
					$fixed_section[] = $this->wrap_into_row(
						array(
							$this->wrap_into_column(
								array($section[$i])
							)
						)
					);
					break;
					// TODO: determine some good way to handle custom item types
					// $fixed_section[] = apply_filters('fw_ext_page-builder_custom_item_section_correction', $section[$i], $this, $fixed_section);
			}
		}

		return $fixed_section;
	}

	/**
	 * Nested columns: if a column's _items contain child columns, run those
	 * _items back through correct_section() so the child columns get grouped
	 * into an inner .fw-row (and any stray simple items get their own
	 * column/row, exactly like at the section level). A column with no child
	 * columns is returned unchanged so existing simple-only columns keep
	 * rendering their leaves directly.
	 *
	 * Depth is naturally handled by the recursion (each level wraps its own
	 * columns). The editor caps authoring at one level; this stays robust for
	 * any depth that arrives via import or hand-authored JSON.
	 *
	 * @param array $column A page-builder column item (type === 'column').
	 * @return array
	 */
	private function correct_nested_columns( $column ) {
		if ( empty( $column['_items'] ) || ! is_array( $column['_items'] ) ) {
			return $column;
		}

		$has_child_column = false;
		foreach ( $column['_items'] as $child ) {
			if ( isset( $child['type'] ) && $child['type'] === 'column' ) {
				$has_child_column = true;
				break;
			}
		}

		if ( ! $has_child_column ) {
			return $column;
		}

		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( '[nested-col] corrector: synthesizing inner row for column ' .
				( isset( $column['atts']['unique_id'] ) ? $column['atts']['unique_id'] : '?' ) );
		}

		$column['_items'] = $this->correct_section( $column['_items'] );

		return $column;
	}

	private function correct_root_items()
	{
		/**
		 * @var FW_Extension_Shortcodes $shortcodes_extension
		 */
		$shortcodes_extension = fw_ext('shortcodes');

		$items = $this->items;
		$fixed_items = array();

		$auto_generated_section = array();
		for ($i = 0, $count = count($items); $i < $count; $i++) {
			if (FW_Section_Like_Registry::is_section_like($items[$i]['type'])) {
				if (!empty($auto_generated_section)) {
					$fixed_items[] = $this->wrap_into_section($auto_generated_section, array(
						'atts' => array(
							'auto_generated' => true
						)
					));
					$auto_generated_section = array();
				}

				$fixed_items[] = $items[$i];
			} else {
				switch ($items[$i]['type']) {
					case 'column':
						$columns   = array($this->correct_nested_columns($items[$i]));
						$this->row_container->empty_container();
						$this->row_container->add_column($items[$i]['width']);
						while (isset($items[$i+1]) && $items[$i+1]['type'] === 'column') {
							$i++;
							if ($this->row_container->add_column($items[$i]['width'])) {
								$columns[] = $this->correct_nested_columns($items[$i]);
							} else {
								$auto_generated_section[] = $this->wrap_into_row($columns);

								$columns = array($this->correct_nested_columns($items[$i]));
								$this->row_container->empty_container();
								$this->row_container->add_column($items[$i]['width']);
							}
						}
						$auto_generated_section[] = $this->wrap_into_row($columns);
						break;

					case 'simple':
						if (
							($shortcode_instance = $shortcodes_extension->get_shortcode($items[$i]['shortcode']))
							&&
							(
								$shortcode_instance->get_config('page_builder/disable_correction')
								||
								$shortcode_instance->get_config('page_builder/disable_root_correction')
							)
						) {
							$fixed_items[] = $items[$i];
						} else {
							$auto_generated_section[] = $this->wrap_into_row(
								array(
									$this->wrap_into_column(
										array( $items[ $i ] )
									)
								)
							);

							while ( isset( $items[ $i + 1 ] ) && $items[ $i + 1 ]['type'] === 'simple' ) {
								if (
									($shortcode_instance = $shortcodes_extension->get_shortcode($items[$i + 1]['shortcode']))
									&&
									$shortcode_instance->get_config('page_builder/disable_correction')
								) {
									$fixed_items[]          = $this->wrap_into_section( $auto_generated_section, array(
										'atts' => array(
											'auto_generated' => true
										)
									) );
									$auto_generated_section = array();

									break;
								}

								++$i;
								$auto_generated_section[] = $this->wrap_into_row(
									array(
										$this->wrap_into_column(
											array( $items[ $i ] )
										)
									)
								);
							}
						}
						break;

					default:
						if (
							/** @since 1.6.14 */
							apply_filters(
								'fw-ext:page-builder:disable-builder-item-correction:'. $items[$i]['type'],
								false
							)
						) {
							$fixed_items[] = $items[$i];
						} elseif (
							/** @since 1.6.14 */
							$manually_corrected_item = apply_filters(
								'fw-ext:page-builder:manual-builder-item-correction:'. $items[$i]['type'],
								false,
								$items[$i],
								array(
									'correct_section' => array($this, 'correct_section'),
									'wrap_into_section' => array($this, 'wrap_into_section'),
									'wrap_into_row' => array($this, 'wrap_into_row'),
									'wrap_into_column' => array($this, 'wrap_into_column'),
								)
							)
						) {
							$fixed_items[] = $manually_corrected_item;
						} else {
							$auto_generated_section[] = $this->wrap_into_row(
								array(
									$this->wrap_into_column(
										array($items[$i])
									)
								)
							);
							while (isset($items[$i + 1]) && $items[$i + 1]['type'] === 'simple') {
								$i++;
								$auto_generated_section[] = $this->wrap_into_row(
									array(
										$this->wrap_into_column(
											array($items[$i])
										)
									)
								);
							}
						}
				}
			}
		}

		if (!empty($auto_generated_section)) {
			$fixed_items[] = $this->wrap_into_section($auto_generated_section, array(
				'atts' => array(
					'auto_generated' => true
				)
			));
		}

		$this->items = $fixed_items;
	}
}
