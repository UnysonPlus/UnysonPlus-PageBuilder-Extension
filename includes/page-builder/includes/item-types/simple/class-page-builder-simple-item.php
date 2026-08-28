<?php if (!defined('FW')) die('Forbidden');

class Page_Builder_Simple_Item extends Page_Builder_Item
{
	private $type = 'simple';

	public function get_type()
	{
		return $this->type;
	}

	public function enqueue_static()
	{
		$static_uri = fw()->extensions->get('page-builder')->get_uri(
			'/includes/page-builder/includes/item-types/simple/static'
		);

		$version = fw()->extensions->get('page-builder')->manifest->get_version();

		wp_enqueue_style(
			$this->get_builder_type() . '_item_type_' . $this->get_type(),
			$static_uri . '/css/styles.css',
			array('fw'),
			$version
		);

		wp_enqueue_script(
			$this->get_builder_type() . '_item_type_' . $this->get_type(),
			$static_uri . '/js/scripts.js',
			array('fw', 'fw-events'),
			$version,
			true
		);

		{
			$builder_data = fw_ext('shortcodes')->get_builder_data();

			foreach ($builder_data as $tag => $item_data) {
				if (!empty($item_data['options'])) {
					fw()->backend->enqueue_options_static($item_data['options']);
				}
			}

			/**
			 * Dedupe repeated option subtrees before localizing.
			 *
			 * Every element's options embed the same Animations tab. With the Animation
			 * Engine active that tab is ~500KB, and localizing a verbatim copy for each of
			 * the 80+ elements produced a ~37MB inline script — big enough to exhaust PHP
			 * memory while WP 7's inline-script printer (WP_HTML_Tag_Processor) duplicates
			 * the document, which fatals the whole edit screen mid-footer (and with it the
			 * section-like factory, so saved pages showed "Cannot detect Item type").
			 *
			 * Any big top-level option subtree that repeats verbatim across elements is
			 * stored ONCE in a shared dictionary (keyed by content hash) and referenced
			 * from the per-element data; itemData() in scripts.js re-inflates the
			 * reference. An element with a customised (non-identical) tab keeps its own
			 * inline copy, so nothing changes semantically.
			 */
			$shared_subtrees = array();
			{
				$hash_counts = array();
				$hashed      = array();

				foreach ($builder_data as $tag => $item_data) {
					if (empty($item_data['options']) || !is_array($item_data['options'])) {
						continue;
					}
					foreach ($item_data['options'] as $idx => $opt) {
						if (!is_array($opt)) {
							continue;
						}
						$s = serialize($opt);
						if (strlen($s) < 65536) {
							continue; // only big subtrees are worth deduping
						}
						$hash                 = md5($s);
						$hash_counts[$hash]   = isset($hash_counts[$hash]) ? $hash_counts[$hash] + 1 : 1;
						$hashed[$tag][$idx]   = $hash;
					}
				}

				foreach ($hashed as $tag => $idxs) {
					foreach ($idxs as $idx => $hash) {
						if ($hash_counts[$hash] < 2) {
							continue; // unique to one element — keep it inline
						}
						if (!isset($shared_subtrees[$hash])) {
							$shared_subtrees[$hash] = $builder_data[$tag]['options'][$idx];
						}
						$builder_data[$tag]['options'][$idx] = array('__fw_shared_option__' => $hash);
					}
				}

				unset($hash_counts, $hashed);
			}

			wp_localize_script(
				$this->get_builder_type() . '_item_type_' . $this->get_type(),
				str_replace('-', '_', $this->get_builder_type()) . '_item_type_' . $this->get_type() . '_data',
				$builder_data
			);

			wp_localize_script(
				$this->get_builder_type() . '_item_type_' . $this->get_type(),
				str_replace('-', '_', $this->get_builder_type()) . '_item_type_' . $this->get_type() . '_shared_options',
				array('subtrees' => $shared_subtrees)
			);

			unset($builder_data, $shared_subtrees);
		}

		/** Fires when the simple builder item type enqueues its static assets, so extensions can enqueue alongside it. */
		do_action('fw:ext:page-builder:item-type:simple:enqueue_static');
	}

	/**
	 * @return array(
	 *  array(
	 *      'tab'   => __('Tab 1', 'fw'),
	 *      'title' => __('thumb title 1', 'fw'),
	 *      'data'  => array( // optional
	 *          'key1'  => 'value1',
	 *          'key2'  => 'value2'
	 *      )
	 *  ),
	 *  array(
	 *      'tab'   => __('Tab 2', 'fw'),
	 *      'title' => __('thumb title 2', 'fw'),
	 *      'data'  => array( // optional
	 *          'key1'  => 'value1',
	 *      )
	 *  ),
	 *  ...
	 * )
	 */
	protected function get_thumbnails_data()
	{
		$data = fw_ext('shortcodes')->get_builder_data();
		$thumb_data = array();
		foreach ($data as $id => $item) {
			$thumb_data[$id] = array(
				'tab'           => $item['tab'],
				'title'         => $item['title'],
				'description'   => $item['description'],
				'data'          => array(
					'shortcode' => $id
				)
			);

			if (isset($item['icon'])) {
				$thumb_data[$id]['icon'] = $item['icon'];
			}
		}

		$this->sort_thumbnails($thumb_data);
		return $thumb_data;
	}

	/*
	 * Sorts the thumbnails by their titles
	 */
	private function sort_thumbnails(&$thumbnails)
	{
		usort($thumbnails, array($this, 'sort_thumbnails_helper'));
		return $thumbnails;
	}

	private function sort_thumbnails_helper($thumbnail1, $thumbnail2)
	{
		return strcasecmp($thumbnail1['title'], $thumbnail2['title']);
	}

	public function get_value_from_attributes($attributes)
	{
		// simple items do not contain other items
		unset($attributes['_items']);

		/**
		 * @var FW_Extension_Shortcodes $shortcodes_ext
		 */
		$shortcodes_ext = fw_ext('shortcodes');

		if (
			($shortcode_data = $shortcodes_ext->get_shortcode_builder_data($attributes['shortcode']))
			&&
			isset($shortcode_data['options'])
		) {
			if (empty($attributes['atts'])) {
				/**
				 * The options popup was never opened and there are no attributes.
				 * Extract options default values.
				 */
				$attributes['atts'] = fw_get_options_values_from_input( $shortcode_data['options'], array() );
			} else {
				/**
				 * There are saved attributes.
				 * But we need to execute the _get_value_from_input() method for all options,
				 * because some of them may be (need to be) changed (auto-generated) https://github.com/ThemeFuse/Unyson/issues/275
				 * Add the values to $option['value']
				 */
				$options = fw_extract_only_options($shortcode_data['options']);

				foreach ($attributes['atts'] as $option_id => $option_value) {
					if (isset($options[$option_id])) {
						$options[$option_id]['value'] = $option_value;
					}
				}

				try {
					$attributes['atts'] = fw_get_options_values_from_input( $options, array() );
				} catch ( \Throwable $e ) {
					/**
					 * Resilience guard against silent content loss on plugin updates.
					 *
					 * When an option's stored VALUE SHAPE changed between plugin
					 * versions (e.g. a field became a different option type), re-deriving
					 * its value here can throw. Without this catch, one bad option aborts
					 * the whole conversion and the item loads with EMPTY atts — and if the
					 * page is then saved in that blank state, the user's real content
					 * (image, text, every other field) is silently overwritten with
					 * nothing. Keeping the raw saved atts means a shape change can, at
					 * worst, mis-render a single field — never wipe the whole item.
					 */
					unset( $e );
				}
			}
		}

		return $attributes;
	}

	public function get_shortcode_data($atts = array())
	{
		$return = array(
			'tag' => $atts['shortcode'],
		);

		if (isset($atts['atts'])) {
			$return['atts'] = $atts['atts'];
		}

		return $return;
	}
}
