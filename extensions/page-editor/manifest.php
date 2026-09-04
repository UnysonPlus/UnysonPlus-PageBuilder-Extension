<?php if ( ! defined( 'FW' ) ) {
	die( 'Forbidden' );
}

/**
 * Page Editor — a hidden child of the Page Builder.
 *
 * Replaces the WordPress block editor (Gutenberg) with the classic full-width editing screen on
 * every post type that supports the Page Builder, so the builder needs NO Classic Editor plugin.
 * The user stays inside the normal WordPress dashboard — left menu, Publish box, and every other
 * plugin's meta boxes (All in One SEO, Yoast, …) all render as usual.
 *
 * It rides with the Page Builder: hidden from the Extensions manager, active exactly when the
 * builder is. Disable the Page Builder and this turns off too — the block editor returns (the
 * intended "if you want Gutenberg, disable the builder" behaviour).
 */
$manifest = array(
	'display'     => false, // hidden — not user-managed; rides with the Page Builder
	'standalone'  => true,
	'name'        => __( 'Page Editor', 'fw' ),
	'description' => __( 'Replaces the WordPress block editor with the classic editing screen on Page Builder post types (no Classic Editor plugin needed).', 'fw' ),
	'version'     => '1.0.0',
);
