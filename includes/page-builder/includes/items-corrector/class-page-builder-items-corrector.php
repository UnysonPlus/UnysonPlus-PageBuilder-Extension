<?php if (!defined('FW')) die('Forbidden');

class _Page_Builder_Items_Corrector
{
	private $row_container;

	private $column_wrap ;
	private $row_wrap;
	private $section_wrap;
	private $container_wrap; // optional — only when the `container` item type is registered

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

		// The Container layout element is optional. When present we can wrap a section's own
		// loose columns into its default .fw-container so user Container elements sit beside it.
		if ( isset( $item_types['container'] ) ) {
			$this->container_wrap = $item_types['container']->get_value_from_attributes(array(
				'_items' => array()
			));
		}
	}

	/**
	 * Wrap items (rows) into a Container item — the section's own default .fw-container, or a
	 * user Container element. `$fluid` toggles .fw-container vs .fw-container-fluid.
	 *
	 * @param array $items
	 * @param bool  $fluid
	 * @return array
	 */
	public function wrap_into_container($items, $fluid = false)
	{
		if ( ! is_array( $this->container_wrap ) ) {
			// Container item type not registered — leave the rows as-is (no restructure).
			return $this->wrap_into_row( $items );
		}
		$wrapper           = $this->container_wrap;
		$wrapper['_items'] = $items;
		$wrapper['atts']   = array_merge(
			isset( $wrapper['atts'] ) && is_array( $wrapper['atts'] ) ? $wrapper['atts'] : array(),
			array( 'is_fullwidth' => $fluid ? true : false )
		);
		return $wrapper;
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

				// Conditional Container support: ONLY when this section actually contains a
				// `container` item do we restructure its content (lift the section's own loose
				// columns into a default .fw-container so the Container elements sit beside it)
				// and flag the section view to skip its own .fw-container wrapper. A section with
				// NO container is left exactly as before — same code path, identical output.
				$has_container = false;
				if ( is_array( $item['_items'] ) ) {
					foreach ( $item['_items'] as $child ) {
						// Flexbox is treated like Container here: its presence makes the
						// section skip its own .fw-container wrapper so the flexbox (a
						// self-contained flex band) renders directly under <section>.
						if ( isset( $child['type'] ) && ( $child['type'] === 'container' || $child['type'] === 'flexbox' ) ) {
							$has_container = true;
							break;
						}
					}
				}
				if ( $has_container ) {
					$item['atts']['has_inner_containers'] = true;
				}

				$item['_items'] = $this->correct_section(
					$item['_items'],
					! empty( $item['atts']['is_fullwidth'] ),
					$has_container
				);
			}
		}
	}

	public function correct_section($section, $default_fluid = false, $has_container = null)
	{
		/**
		 * @var FW_Extension_Shortcodes $shortcodes_extension
		 */
		$shortcodes_extension = fw_ext('shortcodes');

		// Detect Container elements among this section's items (unless the caller already knows).
		if ( $has_container === null ) {
			$has_container = false;
			foreach ( $section as $it ) {
				if ( isset( $it['type'] ) && ( $it['type'] === 'container' || $it['type'] === 'flexbox' ) ) {
					$has_container = true;
					break;
				}
			}
		}

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

				// A Container element: correct its OWN columns into rows (recursively) and keep
				// it as a sibling — it is NOT wrapped in a row/column. Its boxed/full-width class
				// is rendered by the container view from its own is_fullwidth att.
				case 'container':
					$section[$i]['_items'] = $this->correct_section(
						isset( $section[$i]['_items'] ) && is_array( $section[$i]['_items'] ) ? $section[$i]['_items'] : array(),
						! empty( $section[$i]['atts']['is_fullwidth'] )
					);
					$fixed_section[] = $section[$i];
					break;

				// A Flexbox element: a self-contained flex container. Keep it as a
				// SIBLING (NOT wrapped in a row/column) AND leave its children
				// untouched — they are direct flex items (the flexbox view emits its
				// own <tag class="d-flex …">), so running them through the grid
				// corrector would wrap them in columns and break the flex layout.
				case 'flexbox':
					$fixed_section[] = $section[$i];
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

		// No Container element in this section → behave exactly as before (rows as-is). This is
		// the unchanged path for every existing section.
		if ( ! $has_container ) {
			return $fixed_section;
		}

		// Container(s) present → group the section's own consecutive row items into its default
		// .fw-container (boxed/fluid per the section's is_fullwidth) and leave Container elements
		// as siblings. Result: [default container][container][…] — siblings, never nested. The
		// section view, flagged via has_inner_containers, renders these directly (no extra wrap).
		$result  = array();
		$pending = array();
		foreach ( $fixed_section as $it ) {
			// Containers AND flexboxes stay as siblings; loose rows around them get
			// grouped into the section's default .fw-container.
			if ( isset( $it['type'] ) && ( $it['type'] === 'container' || $it['type'] === 'flexbox' ) ) {
				if ( $pending ) {
					$result[] = $this->wrap_into_container( $pending, $default_fluid );
					$pending = array();
				}
				$result[] = $it;
			} else {
				$pending[] = $it;
			}
		}
		if ( $pending ) {
			$result[] = $this->wrap_into_container( $pending, $default_fluid );
		}

		return $result;
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

					case 'flexbox':
						// A root-level flexbox is its OWN top-level band — no auto
						// <section> wrapper (the true flex-container model). Flush any
						// pending auto-section first so order is preserved, then emit the
						// flexbox as-is; its children stay un-wrapped (they are flex items,
						// and a nested flexbox is emitted via the fw_inner_flexbox alias).
						if ( ! empty( $auto_generated_section ) ) {
							$fixed_items[] = $this->wrap_into_section( $auto_generated_section, array(
								'atts' => array( 'auto_generated' => true ),
							) );
							$auto_generated_section = array();
						}
						$fixed_items[] = $items[$i];
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
