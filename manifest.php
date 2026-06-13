<?php if (!defined('FW')) die('Forbidden');

$manifest = array();

$manifest['name']        = __( 'Page Builder', 'fw' );
$manifest['slug']        = 'unysonplus-pagebuilder';
$manifest['description'] = __(
    'Lets you easily build countless pages with the drag and drop visual page builder, '
  . 'which comes with many ready-made shortcodes.',
    'fw'
);

$manifest['version']     = '1.6.39';
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

/**
 * Changelog
 * -----------------------------------------------------------------------------
 * 1.6.26 - Page Builder Settings: both styling-layer fields are now OPT-OUT
 *          (unchecked by default, feature still on by default). `enqueue_bootstrap`
 *          → `disable_bootstrap` ("Dequeue Bootstrap 5 CSS"); the new
 *          `disable_styling_presets` ("Disable Styling Presets") replaces the
 *          earlier opt-in `styling_presets`. Reads inverted accordingly in
 *          framework/includes/bootstrap.php (unysonplus_enqueue_bootstrap) and
 *          unysonplus_styling_presets_enabled() (css-tokens.php), both defaulting
 *          to false = enabled. Pre-launch, so no migration.
 *
 * 1.6.25 - Follow-up to 1.6.24: keep dropped elements top-aligned. The column's
 *          content container is itself a flex row (.fw-row), so full-width leaf
 *          items wrap onto separate flex lines; once the container was grown to
 *          fill the column (1.6.24), the default align-content spread those lines
 *          apart vertically. Set align-content:flex-start so they pack at the top
 *          (empty space stays below as the drop zone). Editor-only.
 *
 * 1.6.24 - Fixed: empty flex columns are now fully droppable. With equal-height
 *          columns (align-items:stretch) an empty column stretches to match a
 *          taller sibling, but its inner content/drop container stayed ~83px tall
 *          at the top — leaving a dead zone where dropping an element did nothing
 *          unless you aimed at the very top. The column card is now a flex column
 *          and its content container grows (flex:1 1 auto) to fill it, so the
 *          whole empty column accepts drops. The container itself stays block (not
 *          flex), so jQuery-UI sortable cross-container moves keep working.
 *          (Versions 1.6.21–1.6.23 were experimental visual-refresh / grid-parity
 *          work that was reverted; this continues from 1.6.20.)
 *
 * 1.6.19 - Device preview toggle (Desktop / Tablet / Phone) in the builder toolbar.
 *          The canvas previewed only the Desktop breakpoint, so the responsive
 *          column width/offset and masonry column-count settings were invisible
 *          while editing. New static/js/device-preview.js adds a 3-button toggle
 *          (mirrors section-sorter's toolbar injection) that puts an
 *          `fw-device-{lg|md|sm}` class on the builder root + a `window.fwPbDevice`
 *          global, fires `fw:builder:device-preview`, and dispatches a synthetic
 *          resize. device-preview.css constrains the canvas to a device-width frame
 *          (768/375px) so percentage widths render at realistic sizes; the column
 *          item view re-resolves width/offset for the active breakpoint and the
 *          masonry editor CSS switches to --mc-md / --mc-sm. Choice persists in
 *          localStorage; default Desktop = unchanged behavior. Editor-only.
 *
 * 1.6.18 - Section-like factory now tags each item's template root with a
 *          per-type class (`pb-section-like-{type}`) and mirrors its `cols_*`
 *          atts onto the child `.builder-items` as `--mc-*` custom properties.
 *          This lets type-specific editor CSS target a section-like variant —
 *          used by the new Masonry Section (shortcodes 1.5.29) to preview its
 *          child columns as a grid in the canvas. Harmless for Section / Hero
 *          Section (they define no such atts).
 *
 * 1.6.14 - Modernized canvas: flexbox column rows. The editor canvas laid columns
 *          out with display:inline-block (whitespace gaps, no equal heights,
 *          imperfect wrapping), so it didn't match the flexbox frontend. A new
 *          static/css/flex-canvas.css now flips canvas column rows to real flexbox
 *          (flex-wrap + align-items:stretch for equal-height columns), scoped via
 *          :has(> .builder-item[data-builder-item-type="column"]) so section/root/
 *          leaf containers keep stacking. It's enqueued ONLY when Bootstrap-3 Legacy
 *          Mode is OFF — gated by the same setting the frontend grid uses, so no new
 *          toggle is added (Legacy ON keeps the classic inline-block canvas). Editor-
 *          only: saved shortcode output is unchanged. First step of the page-builder
 *          modernization.
 *
 * 1.6.10 - Drag-helper drift hunt round 2 (see framework 2.8.26). The 1.6.9
 *          diagnostic that disabled the three new page-builder admin assets
 *          (section-like-factory.js, section-sorter.js, section-sorter.css)
 *          did NOT eliminate the cursor-vs-helper drift, so those files are
 *          not the cause — restored their enqueues in
 *          `includes/page-builder/class-fw-option-type-page-builder.php`.
 *          The Sort Sections UI is back in the header.
 *
 *          New diagnostic: in `includes/page-builder/static/css/styles.css`
 *          the two CURRENT-vs-OLD additions on `.fw-option-type-builder
 *          .fw-option-type-page-builder .builder-item-type` —
 *          `border-radius: .25rem;` and `margin: .25rem;` — are commented
 *          out behind a TEMP marker tagged with this version. The margin
 *          is the prime suspect because `.builder-item-type` is the
 *          element jQuery UI clones as the drag helper, and the cloned
 *          helper picks up the same margin via this selector. A non-zero
 *          margin on the source shifts the cursor-vs-helper offset every
 *          time the helper crosses into a connected sortable (each column's
 *          `.builder-items` is its own sortable), which matches exactly the
 *          cumulative drift the user is seeing. Paired with builder 1.2.32
 *          which disables a related new rule in `builder.css`. If drift
 *          disappears, the cosmetic margin gets restored in a scoped form
 *          (e.g. `.thumbnails .builder-item-type` only, so the cloned
 *          helper does NOT pick it up).
 *
 * 1.6.9 - TEMPORARY DIAGNOSTIC for the residual page-builder drag-helper
 *         drift (see framework 2.8.25, shortcodes 1.4.78). The three admin
 *         enqueues this option type added earlier this session
 *         (section-like-factory.js + its localized `_fw_section_like_types`,
 *         section-sorter.js + its localized `_fw_page_builder_section_sorter`,
 *         and section-sorter.css) are wrapped in a `TEMP — diagnostic …`
 *         comment block in
 *         `includes/page-builder/class-fw-option-type-page-builder.php`.
 *         The user's report on whether the cursor-vs-helper drift disappears
 *         tells us whether the regression sits in one of these new files or
 *         somewhere else entirely. Sort Sections UI is hidden from the
 *         page-builder header while this is active; the PHP registry and
 *         `Page_Builder_Section_Like_Item` base class are untouched so
 *         saved `[hero_section]` storage continues to load. Restore (or
 *         replace with a real fix) in the next patch.
 *
 * 1.6.8 - The "Bootstrap 3 Legacy Stylesheet" checkbox in Page Builder
 *         Settings is now a broader "Bootstrap 3 Legacy Mode" toggle that
 *         couples two Bootstrap-3-era behaviours that always belonged
 *         together: (a) loading `bootstrap-3-legacy.css` (existing
 *         behaviour, unchanged) and (b) the page-builder's auto-split of
 *         columns into separate `[row]` shortcodes when their combined
 *         width exceeds one row (NEW — previously only controllable via
 *         the developer-only `disable_columns_auto_wrap` static config
 *         flag). `Page_Builder_Items_Corrector_Row_Container::column_fits()`
 *         in `includes/items-corrector/class-page-builder-items-corrector-row-container.php`
 *         gained a second short-circuit that reads
 *         `fw_get_db_ext_settings_option('page-builder',
 *         'load_bootstrap_3_legacy_css', false)` before falling through
 *         to the fraction-based split. Unchecked (default) = Bootstrap 5
 *         flex-wrap behaviour, all columns share one `.fw-row` and the
 *         user's Default Gap Y applies between wrapped sub-rows. Setting
 *         field key (`load_bootstrap_3_legacy_css`) is unchanged — only
 *         the user-visible label/text/desc updated, so any existing saved
 *         value flows straight through without migration. Pair with
 *         plugin 2.7.124.
 *
 * 1.6.7 - Page Builder Settings gained an "Enqueue Bootstrap 5 CSS" checkbox
 *         (default checked) alongside the existing "Bootstrap 3 Legacy
 *         Stylesheet" field in `settings-options.php`. Pairs with plugin
 *         2.7.122 which moved Bootstrap into the plugin (
 *         `framework/static/css/bootstrap.min.css` enqueued by
 *         `framework/includes/bootstrap.php` at `wp_enqueue_scripts`
 *         priority 5). Unchecking the new checkbox tells
 *         `unysonplus_enqueue_bootstrap()` to skip its enqueue —
 *         intended for power users running Tailwind or a custom CSS
 *         layer who want only the plugin's `frontend-grid.css` baseline.
 *         Setting key: `enqueue_bootstrap`, read via
 *         `fw_get_db_ext_settings_option( 'page-builder', 'enqueue_bootstrap', true )`.
 *
 * 1.6.6 - Hotfix to v1.6.5: `Page_Builder_Section_Like_Item` defined a
 *         `__construct()` that called the registry / corrector filters, but
 *         `FW_Option_Type_Builder_Item::__construct()` in the builder extension
 *         is declared `final`. PHP raised "Cannot override final method"
 *         the moment any subclass was loaded — the bundled `[hero_section]`
 *         alone was enough to fatal the site on plugin activation. Moved
 *         the registration to `_init()`, the framework's documented
 *         extension point that `_call_init()` runs right after the item is
 *         registered. No behavior change.
 *
 * 1.6.5 - Section-like type framework. Multiple `[section]`-equivalent
 *         shortcodes can now be registered as separate item types and they all
 *         behave correctly with the page-builder's hierarchy / corrector /
 *         drag-and-drop / sort dropdown. New classes
 *         `FW_Section_Like_Registry` and `Page_Builder_Section_Like_Item` live
 *         under `includes/page-builder/includes/item-types/`; JS
 *         `section-like-factory.js` exposes the matching `window.fwSectionLikeTypes`
 *         and `createSectionLikeItem()` factory. The items-corrector's two
 *         hardcoded `$item['type'] === 'section'` checks (lines 70 + 172) now
 *         call `FW_Section_Like_Registry::is_section_like()`; auto-generated
 *         wrappers still use the literal `'section'` type — only user-placed
 *         items can be section-like variants. `section-sorter.js`'s filter
 *         now lists every section-like item, not only literal sections. The
 *         option-type-page-builder enqueue pipeline got `fw-section-like-factory`
 *         as a new script handle (loaded before any per-variant scripts.js) and
 *         a `_fw_section_like_types` localized initial-type list.
 *
 * 1.6.4 - New "Sort Sections" dropdown in the page-builder header (left of the
 *         Templates button). Lists every root section in a qtip2 dropdown with
 *         a drag handle, collapse toggle, and click-to-scroll-to-section.
 *         Drag-reorder inside the dropdown calls the same Backbone collection
 *         remove/add (silent) + `builder:change` trigger that canvas drag uses,
 *         so undo/redo and JSON serialization stay consistent. Added two static
 *         assets (`static/js/section-sorter.js`, `static/css/section-sorter.css`)
 *         and the matching `wp_enqueue_*` calls in the page-builder option type.
 */
