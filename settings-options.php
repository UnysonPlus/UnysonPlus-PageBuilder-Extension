<?php if ( ! defined( 'FW' ) ) {
        die( 'Forbidden' );
}

// Post types the Page Editor can replace the block editor on (excludes block-only internal
// types); offered as opt-out checkboxes so a type (e.g. Posts) can keep the block editor.
$fw_pe_keep_choices = array();
foreach ( get_post_types( array( 'show_ui' => true ), 'objects' ) as $fw_pe_pt ) {
	if (
		in_array( $fw_pe_pt->name, array( 'wp_block', 'wp_template', 'wp_template_part', 'wp_navigation', 'wp_global_styles' ), true )
		|| ! post_type_supports( $fw_pe_pt->name, 'editor' )
	) {
		continue;
	}
	$fw_pe_label = ( isset( $fw_pe_pt->labels->name ) && $fw_pe_pt->labels->name ) ? $fw_pe_pt->labels->name : $fw_pe_pt->name;
	$fw_pe_keep_choices[ $fw_pe_pt->name ] = $fw_pe_label . ' (' . $fw_pe_pt->name . ')';
}

$options = array(
        'general-tab' => array(
                'title'   => '',
                'type'    => 'box',
                'options' => array(
                        'post_types' => array(
                                'label'   => __( 'Activate for', 'fw' ),
                                'type'    => 'checkboxes',
                                'choices' => fw_ext_page_builder_get_supported_post_types(),
                                /** Filters the default post types the page builder is activated for (default page). */
                                'value'   => apply_filters(
                                        'fw_ext_page_builder_settings_options_post_types_default_value',
                                        array( 'page' => true )
                                ),
                                'desc'    => __( 'Select the posts you want the Page Builder extension to be activated for', 'fw' )
                        ),
                        'load_bootstrap_3_legacy_css' => array(
                                'label' => __( 'Bootstrap 3 Legacy Mode', 'fw' ),
                                'type'  => 'checkbox',
                                'value' => false,
                                'text'  => __( 'Enable Bootstrap 3 compatibility (legacy stylesheet + column auto-split)', 'fw' ),
                                'desc'  => __( 'Migration mode for sites built on the original Unyson plugin. Two Bootstrap-3-era behaviours kick in together: <br><br>(1) Loads <code>builder/static/css/bootstrap-3-legacy.css</code> on every frontend page so existing <code>.fw-container</code> / <code>.fw-row</code> markup keeps the old float-based grid widths. <br><br>(2) The page-builder auto-splits groups of columns into separate <code>[row]</code> shortcodes whenever their combined width exceeds one row — e.g. eight 1/4 columns become two <code>.fw-row</code> wrappers of 4 each. <br><br><strong>Leave off for new UnysonPlus sites.</strong> Bootstrap 5\'s flex grid wraps naturally inside one <code>.fw-row</code>, and Theme Settings → Default Gap Y only takes effect between wrapped sub-rows of the same row.', 'fw' ),
                        ),
                        'disable_styling_presets' => array(
                                'label' => __( 'Styling Presets', 'fw' ),
                                'type'  => 'checkbox',
                                'value' => false,
                                'text'  => __( 'Disable Styling Presets (bare, structure-only page builder)', 'fw' ),
                                'desc'  => __( 'Designed for developers who want a pure page builder experience and prefer styling elements manually using custom CSS classes. By default shortcodes get a <strong>Styling</strong> tab and the Button / Border / Table <strong>preset pickers</strong>, the <strong>Component Presets</strong> editor appears under the Unyson+ menu, and the generated <code>presets.css</code> (Color / Typography / Spacing / Button / Border / Table utility classes) is enqueued. <br><br><strong>Check this for a bare, structure-only page builder</strong> — for developers who style everything with their own CSS via each element\'s <strong>CSS ID / Class</strong> (Advanced tab). The Styling tab, preset pickers and Component Presets page disappear, and <code>presets.css</code> stops loading. <br><br>Note: this unstyles any content that relied on preset classes, and the <strong>Unyson+ theme depends on these tokens</strong> — so only enable it on a non-Unyson theme with your own CSS. The Animation tab is unaffected (it only loads when used).', 'fw' ),
                        ),
                        'page_editor_keep_block' => array(
                            'label'   => __( 'Keep the block editor for', 'fw' ),
                            'type'    => 'checkboxes',
                            'choices' => $fw_pe_keep_choices,
                            'value'   => array(),
                            'desc'    => __( 'The Page Editor replaces WordPress&rsquo;s block editor (Gutenberg) with the classic editor on every post type, so the Page Builder works with no Classic Editor plugin. Check any post types here to KEEP the block editor for them instead &mdash; e.g. Posts, if you write blog posts in Gutenberg. (Reusable blocks and FSE templates are never affected.)', 'fw' ),
                        ),
                        /** Filters extra page-builder settings options merged into the settings form. */
                        apply_filters('fw_ext_page_builder_settings_options', array())
                )
        )
);
