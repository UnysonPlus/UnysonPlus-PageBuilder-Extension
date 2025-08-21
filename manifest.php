<?php if (!defined('FW')) die('Forbidden');

$manifest = array();

$manifest['name']        = __( 'Page Builder', 'fw' );
$manifest['slug']        = 'unysonplus-pagebuilder';
$manifest['description'] = __(
    'Lets you easily build countless pages with the drag and drop visual page builder, '
  . 'which comes with many ready-made shortcodes.',
    'fw'
);

$manifest['version']     = '1.6.21';
$manifest['display']     = true;
$manifest['standalone']  = true;

// Repository Info
$manifest['github_update'] = 'UnysonPlus/UnysonPlus-PageBuilder-Extension';
$manifest['github_repo']   = 'https://github.com/UnysonPlus/UnysonPlus-PageBuilder-Extension';
$manifest['github_branch'] = 'master';

// Author Info
$manifest['author']     = 'UnysonPlus';
$manifest['author_uri'] = 'https://www.lastimosa.com.ph/unysonplus';

// Meta
$manifest['license']      = 'GPL-2.0-or-later';
$manifest['text_domain']  = 'fw';
$manifest['requires_php'] = '7.4';
$manifest['requires_wp']  = '5.8';

// Requirements
$manifest['requirements'] = array(
    'framework' => array(
        'min_version' => '2.1.19', // Fix for children extension requirements
    ),
    'extensions' => array(
        'builder' => array(),
        'forms'   => array(),
        'shortcodes' => array(
            'min_version' => '1.3.21', // Added get_builder_data() method
        ),
    ),
);
