<?php if ( ! defined( 'FW' ) ) {
        die( 'Forbidden' );
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
                        apply_filters('fw_ext_page_builder_settings_options', array())
                )
        )
);
