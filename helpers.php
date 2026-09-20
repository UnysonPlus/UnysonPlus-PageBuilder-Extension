<?php if (!defined('FW')) die('Forbidden');

/**
 * Returns whether the given post was built with the page builder.
 *
 * Returns whether or not a post was built with the page builder
 */
/** Returns whether the given post was built with the page builder. */
function fw_ext_page_builder_is_builder_post($post_id = '') {
        return fw()->extensions->get('page-builder')->is_builder_post($post_id);
}

/**
 * Post types the page builder is ALWAYS active for, regardless of the "Activate for"
 * setting — because another extension force-adds builder support for them and they have
 * no meaning without the builder (Snippets, and the theme-builder Header/Footer/Body
 * presets). The settings screen shows these checkboxes pre-checked and disabled so the
 * UI stops implying they are optional. Extensions that force support declare themselves
 * through the `fw_ext_page_builder_always_on_post_types` filter.
 *
 * @return string[] Post-type slugs.
 */
function fw_ext_page_builder_always_on_post_types() {
        /** Filters the post types the page builder is always active for (declared by the extensions that force builder support). */
        $types = apply_filters( 'fw_ext_page_builder_always_on_post_types', array() );

        return is_array( $types ) ? array_values( array_unique( array_filter( array_map( 'strval', $types ) ) ) ) : array();
}

/**
 * Returns all post types that can be integrated with the page builder
 */
function fw_ext_page_builder_get_supported_post_types() {
        $cache_key = fw()->extensions->get('page-builder')->get_cache_key('/supported_post_types');

        try {
                return FW_Cache::get($cache_key);
        } catch (FW_Cache_Not_Found_Exception $e) {
                $post_types = get_post_types(array('public' => true), 'objects');

                $result = array();
                foreach ($post_types as $key => $post_type) {
                        if (post_type_supports($key, 'editor')) {
                                $result[$key] = $post_type->labels->name;
                        }
                }

                /** Filters the list of editor-supporting post types the page builder can be enabled for. */
                $result = apply_filters('fw_ext_page_builder_supported_post_types', $result);

                FW_Cache::set($cache_key, $result);

                return $result;
        }
}

/**
 * Returns the shortcodes generated from a post's page-builder JSON builder value.
 *
 * @param int|WP_Post $post
 * @return string Shortcodes generated from post meta json builder value
 * @since 1.5.1
 */
function fw_ext_page_builder_get_post_content($post) {
        static $access_key = null;

        if (is_null($access_key)) {
                $access_key = new FW_Access_Key('fw:ext:page-builder:helper:get-post-content');
        }

        return fw_ext('page-builder')->_get_post_content($access_key, $post);
}

