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
                                'label' => __( 'Bootstrap 3 Legacy Stylesheet', 'fw' ),
                                'type'  => 'checkbox',
                                'value' => false,
                                'text'  => __( 'Load bootstrap-3-legacy.css', 'fw' ),
                                'desc'  => __( 'Enable this if you are migrating an existing site from the original Unyson plugin and your content/templates still use the .fw-container / .fw-row / etc. classes. Loads builder/static/css/bootstrap-3-legacy.css on every frontend page. Leave off for new UnysonPlus sites.', 'fw' ),
                        ),
                        apply_filters('fw_ext_page_builder_settings_options', array())
                )
        )
);
