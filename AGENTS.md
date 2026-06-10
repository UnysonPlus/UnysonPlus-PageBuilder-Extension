---
type: guide
name: page-builder-template-format
audience: AI agents generating page-builder JSON / distributable templates, and maintaining shortcode AGENTS.md from sample exports
last-verified-against: plugin 2.8.49 (section export, format_version 2 — icon_box capture)
---

# Page builder — template format, JSON generation & training workflow

Two jobs live here:

1. **Reference** — the exact shapes an agent must emit to produce importable page-builder
   content: the template-export envelope, the full-page WXR meta, and the builder-tree item
   skeletons shared by every shortcode.
2. **Training workflow** — the routine to run when the user hands over a *sample export*
   (`.json` template or WXR `.xml`): how to verify it, what to update in each shortcode's
   `AGENTS.md`, and how to log it. The user supplies these "from time to time"; this section
   is the standing procedure.

> The per-shortcode `AGENTS.md` (`../../shortcodes/<name>/AGENTS.md`) remains the canonical
> **atts contract** for each shortcode. This guide holds the *shared* shapes (so they aren't
> duplicated 27 times) and the *process*. Don't restate a shortcode's full atts table here.

---

## 1. Distributable template envelope (the free-template mechanism)

Source: `../../shortcodes/section/includes/template-component/class-fw-ext-builder-templates-component-section.php`
(matching `full` and `column` components exist). A distributable template is one `.json` file:

```json
{
  "_fw_template_export": {
    "format_version": 2,          // seen as 1 (2.8.40) and 2 (2.8.47); informational, NOT validated
    "kind": "section",            // "section" | "full" | "column" — MUST match the import list
    "builder_type": "page-builder",
    "plugin_version": "2.8.47",   // informational; NOT validated on import
    "exported_at": 1780419966
  },
  "title": "FAQ + Editorial",
  "json": "<STRINGIFIED builder tree>",   // a JSON *string*, not a nested object
  "created": 1780335039
}
```

**Importer enforces only** (everything else is ignored): user can `edit_posts`; envelope `kind`
=== the list being imported into; envelope `builder_type` === `page-builder`; `json` is a string
decoding to valid JSON whose **top-level `type`** matches the list (`section` / a registered
section-like for the Sections list; `column` for Columns; any for Full); file ≤ 5 MB. Stored as
wp_option `fw:bt:s:page-builder:<md5(json)>`. **`unique_id`s are NOT regenerated on import** — emit
a fresh 32-hex `unique_id` per item to avoid collisions. Pick `kind`: single band → `section`;
whole page (≥1 section) → `full`.

**`json` shape by kind (verified):** `section` and `column` decode to a **single object**
(`{"type":"section",…,"_items":[…]}` — *not* wrapped in an array); `full` decodes to an **array**
of section objects (`[{"type":"section",…},…]`).

## 2. Full-page import via WXR `.xml` (alternative)

A complete published page needs two post-metas (verified in a real single-page export):
- `fw:opt:ext:pb:page-builder:json` = builder tree as a JSON **array** string `[ {section…} ]`.
- `fw_options` = PHP-`serialize()`d array whose `page-builder` key is
  `{ json:"[]", builder_active:true }` (+ page options). `builder_active:true` is what makes the
  theme render builder output. Also set `_wp_page_template = default`.

No gzip observed in either export — plain JSON throughout. (The builder *can* gzip very large
values via `compress_form_value`; not seen in practice here.)

## 3. Builder-tree anatomy (shared shapes — verified)

Tree nests `section → column → simple(leaf)`. Rows are auto-synthesized by the items corrector;
a hand-authored tree may place columns directly under a section (as the real export does).

**Every item** carries these common keys: `unique_id` (32 hex), `css_id` (""), `css_class` (""),
`custom_css` (""), `responsive_hide` ([]), `custom_attrs` ([]), and an `animation` block. Containers
carry `_items`; leaf shortcodes are `{"type":"simple","shortcode":"<atom>","atts":{…},"_items":[]}`.

> **Populated shapes of the common keys** (verified vs `button-test-section-6f2a34c9.json`):
> `custom_attrs` → `[{"name":"aria-label","value":"test"}]` (list of custom HTML attributes);
> `responsive_hide` → `{"hide-xs":true}` (breakpoint→`true` map: `hide-xs`/`hide-sm`/`hide-md`/…);
> and the **`spacing` field's `advanced`** is `[]` when unused but a **breakpoint map when set** —
> `{"lg":{"margin":{"top":"mt-lg-7","right":"me-lg-8",…},"padding":{…}},"md":{…}}` (responsive
> margin/padding utility classes). All three are general — they apply to every shortcode.

- **`custom_css`** — per-item raw CSS (the shared `group_css` field, alongside `css_id`/`css_class`,
  plus `inner_class` on columns). Use the literal token `selector` for the item's auto-generated
  wrapper selector, e.g. `"custom_css":"selector {\r\npadding-top: 50px;\r\n}"`. Empty string when unused.
  - **DRY pattern (preferred for repeated children):** put the CSS **once on the section**, scoped to
    a child class via a descendant selector, and add that class to each column's `css_class` — e.g.
    section `custom_css`: `selector .nbs-step{ … } selector .nbs-step:hover{ … }`, columns
    `css_class:"nbs-step"`. Avoids repeating the same `custom_css` on every column and keeps the
    generated stylesheet small. (`selector` → the section's scope class, so `selector .nbs-step`
    matches its descendant columns.) Verified: `newbingosites.net mockup/test-section-section-00a35c97.json`.
- **`responsive_hide`** — `[]` (empty array) when nothing is hidden, but a **breakpoint→`true` map**
  when set: `{"hide-md":true}` (keys `hide-sm` / `hide-md` / `hide-lg` … per the breakpoint toggled).
- **`background_image`** (section) is an **object** (image-picker shape), not a string:
  `{"type":"custom","custom":"","predefined":"","data":{"icon":"","css":[]}}`. `""` only on legacy exports.
- Observed `section.variant` values: `""` (default), `"alt"`, `"dark"`; `is_fullwidth` toggles `true`.
- **`*_color` `predefined`** half holds a preset utility class — `bg-{slug}` for `bg_color`
  (e.g. `"bg-yellow"`), `text-{slug}` for text colors; `custom` holds a hex. The two are mutually
  exclusive (set one, leave the other `""`).

> **Atoms use underscores**, not the hyphenated folder name: `special_heading`, `text_block`,
> `icon_box`, `code_block`. **Column `width` is a top-level key** on the column item (sibling to
> `type`/`atts`/`_items`), value like `"1_2"`, `"1_3"`, `"2_3"` (underscore, not slash).

Shared sub-objects (paste verbatim, then fill non-empty values):
```json
"animation": {"enable":"no","yes":{"effect":"animate__fadeInUp","speed_preset":"","advanced_tweaks_heading":"","delay":0,"custom_duration":0,"repeat_count":1,"loop_forever":"no","replay_on_scroll":"no","easing":""}}
"<any>_color": {"predefined":"","custom":""}
"spacing": {"margin":{"all":"","top":"","right":"","bottom":"","left":""},"padding":{"all":"","top":"","right":"","bottom":"","left":""},"advanced":[]}
"background_image": {"type":"custom","custom":"","predefined":"","data":{"icon":"","css":[]}}
"background": {"color":{"value":{"predefined":"","custom":""}},"gradient":{"data":{"type":"linear","angle":90,"stops":[]}},"image":{"src":[],"position":"center center","size":{"selected":"cover","custom":""},"repeat":"no-repeat","attachment":"scroll"},"video":{"enabled":"no","external_url":"","source_mp4":[],"source_webm":[],"poster":[],"fallback":[],"loop":"yes","autoplay":"yes","mute":"yes","playsinline":"yes"},"advanced":[]}
"min_height": {"preset":"auto","custom":{"custom_height":{"value":"","unit":"px"}}}
```

Container skeletons:
```json
// section (top-level)
{"type":"section","atts":{"variant":"","is_fullwidth":false,"background_color":"","background_image":{"type":"custom","custom":"","predefined":"","data":{"icon":"","css":[]}},"video":"","bleed_illustration":"","bleed_layout":{"bleed_enabled":"no","yes":{"bleed_bg_color":"","bleed_image":"","bleed_image_position":"center","bleed_image_side":"right","bleed_image_ratio":"5-7","bleed_vertical_align":"align-items-center","bleed_content_padding":"3rem","bleed_mobile_stacking":"content-first"}},"bg_color":{"predefined":"","custom":""},"padding_top":"","padding_bottom":"","gap":"","gap_x":"","gap_y":"","min_height":{"preset":"auto","custom":{"custom_height":{"value":"","unit":"px"}}},"content_valign":"top","background":{…background…},"animation":{…},"unique_id":"…","css_id":"","css_class":"","custom_css":"","responsive_hide":[],"custom_attrs":[]},"_items":[…]}

// column (width is top-level; the responsive width/offset/align keys mirror it per-device)
{"type":"column","width":"1_2","atts":{"full_height":"no","bg_color":{…},"spacing":{…},"mobile_order":"","w_phone":"default","w_tablet":"default","w_desktop":"default","offset_phone":"none","offset_tablet":"none","offset_desktop":"none","align_self":"default","content_v":"default","content_h":"default","position":"","z_index":"","border_preset":"","animation":{…},"unique_id":"…","css_id":"","css_class":"","custom_css":"","inner_class":"","responsive_hide":[],"custom_attrs":[]},"_items":[…]}
```

> **`background` vs `bg_color`/`background_image`:** modern sections carry a full background-pro
> object under **`background`** (color+gradient+image+video layers — paste the shared block above);
> the legacy `bg_color` (compact `bg-{slug}` / hex) and `background_image` keys remain for back-compat.
> **`min_height`** is the multi-picker `{preset, custom:{custom_height:{value,unit}}}` (`preset:"auto"`
> by default). **Section/column atts are a SUPERSET** — older exports omit the keys added above and
> the importer fills defaults, so a subset still imports; mirror a recent real export for fidelity.

> **Editor-load value-shape resilience (data-loss guard).** On editor load, a simple/leaf item runs
> `Page_Builder_Simple_Item::get_value_from_attributes()`, which re-derives every option's value via
> `fw_get_options_values_from_input()`. If an option's stored value SHAPE changed between plugin
> versions, that re-derivation can throw — and historically one bad option would abort the whole
> conversion, load the item with **EMPTY atts**, and (if the page was then saved) silently wipe the
> user's content. That call is now wrapped in `try { … } catch (\Throwable $e) {}` that **falls back to
> the raw saved atts**, so a shape change can at worst mis-render a single field, never wipe an item.
> This is a safety net, **not** a substitute for proper migration: changing an existing option's type
> is still a breaking change — keep the consuming `view.php` backward-compatible with the old value
> (and add a migrator) so the field also renders correctly, not just survives.

Per-leaf `atts` keys are documented in each shortcode's own `AGENTS.md` "Options schema" table.
**Worked, fully-verified examples** (in the project):
- `newbingosites.net mockup/faq-editorial-section.json` — `kind:section` (section → two `1_2`
  columns → `special_heading` + `text_block` | `accordion`).
- `newbingosites.net mockup/sample-full-page-template-full-7e26f8f2.json` — `kind:full`,
  `format_version:2` (3 sections, each → three `1_3` columns of `special_heading`/`text_block`).
  Demonstrates `variant` `"alt"`/`"dark"`, `is_fullwidth:true`, populated `custom_css`
  (`selector { … }`) and `responsive_hide:{"hide-md":true}`.
- `newbingosites.net mockup/payment-method-section-6e4d05fe.json` — `kind:section` (a heading
  column over a 12-tile grid of sibling `1_4` columns, each one `icon_box`). The canonical
  `icon_box` capture — inline-SVG `custom_icon`, `icon` as `{"type":"none"}`, and `mobile_stack`/
  `link_target` as JSON **booleans**. See the icon-box shortcode AGENTS.md.

## 4. Generating a template — checklist

1. Build the tree from the skeletons above + each leaf's atts table.
2. Give every item a unique 32-hex `unique_id`.
3. `JSON.stringify` the tree into the envelope's `json` string field.
4. Set `kind` correctly (`section`/`full`/`column`); `builder_type:"page-builder"`.
5. Validate: re-parse `json`, confirm top-level `type` matches `kind`.
6. Deliver the `.json`; user imports via Templates → (Sections/Full/Columns) → Import.

---

## 5. TRAINING WORKFLOW — when the user provides a sample export

Run this every time the user drops a new `.json` template or WXR `.xml` ("training data"):

1. **Parse it.** Template `.json` → read `_fw_template_export` + decode the `json` string. WXR
   `.xml` → read the `fw:opt:ext:pb:page-builder:json` meta (+ `fw_options`).
2. **Walk every item.** For each distinct `shortcode` atom (and `section`/`column`), compare the
   real `atts` keys against that shortcode's `AGENTS.md` "Options schema (atts)" table.
3. **Update the shortcode's `AGENTS.md`** (`../../shortcodes/<folder>/AGENTS.md`) when the export reveals:
   - a **new att** not in the table → add the row (att, type, default, description);
   - a **wrong default or shape** → correct it;
   - a **non-obvious serialized shape** (nested objects, per-row arrays) → add/refresh a concise
     **"Verified `atts` (real export)"** fenced snippet under the Options schema (see the accordion
     doc for the pattern). Keep it minimal — the shared blocks (animation/color/spacing) live here
     in §3, so reference them rather than re-pasting.
   - Folder name is hyphenated (`text-block`), the atom is underscored (`text_block`) — note both.
   - `AGENTS.md` edits are docs-only (no runtime effect) → **no version bump** per project rules.
4. **Log it** in the capture table below (shortcode, verified ✓, source file, date).
5. **If a shortcode has no `AGENTS.md`** (rare — most exist), create one from the template at the
   bottom of `../../shortcodes/AGENTS.md`.
6. Note any **gaps** (atts seen but not yet understood) explicitly rather than guessing.

### Capture log

| Shortcode (atom) | Verified | Source export | Date |
|---|---|---|---|
| `section` | ✓ | faqs-section-c48b8528.json / WordPress.2026-06-01.xml; re-verified vs sample-full-page-template-full-7e26f8f2.json; **superset keys** vs payforit-homepage-full-a86dca2d.json | 2026-06-10 |
| `column` | ✓ | same; **responsive width/offset/align keys** vs payforit-homepage-full-a86dca2d.json | 2026-06-10 |
| `special_heading` | ✓ | same (title_class/subtitle_class confirmed; `title` accepts inline HTML — `<em>…</em>`) | 2026-06-10 |
| `text_block` | ✓ | same (font_size_preset confirmed) | 2026-06-03 |
| `accordion` | ✓ | faqs-section-c48b8528.json | 2026-06-02 |
| `icon_box` | ✓ | payment-method-section-6e4d05fe.json; re-verified vs payforit-homepage-full-a86dca2d.json | 2026-06-10 |
| `divider` | ✓ | payforit-homepage-full-a86dca2d.json | 2026-06-10 |
| `code_block` | ✓ | payforit-homepage-full-a86dca2d.json (used for escape-hatch bands; atts = `code`+styling) | 2026-06-10 |
| `button` | ✓ | button-test-section-6f2a34c9.json (5 buttons) | 2026-06-10 |
| `media_image` | ✓ | image-test-section-ca2a301e.json (2 images) | 2026-06-10 |
| `image_content` | ✓ | image-content-section-f38c05cd.json (2.10.31 — column-split, spacing-mode padding, content card) | 2026-06-11 |
| `table` | ☐ pending | — | — |

> **Domain shortcodes (not plugin atoms).** The payforit export also used `casino_finder`
> (`{heading, subheading}`) and `reviews_table` (`{title, icon, category[], post_count}` — a CPT
> query). These live in the site's child theme / a custom plugin, not this extension, so they get
> no plugin `AGENTS.md`. They're the canonical example of the conversion pattern "data/interactive
> band → thin domain shortcode" (see the conversion contract §0.5).

When new exports arrive, extend this table and the matching `AGENTS.md` files.

**2026-06-11 — image-content export (`image-content-section-f38c05cd.json`, 2.10.31):** verified
`image_content` against a real export exercising every new option (post the Tier A/B/C + column-split
work). **No drift.** Pinned in `image-content/AGENTS.md`: **`column_ratio` is a plain integer**
(seen `3`) — the new `column-split` option type stores the image's column span (1–11 of 12), the same
int the old slider stored, so swapping the control needed **no value migration**; **`content_padding`
is the full `spacing` composite** (padding mode) and its responsive `advanced.lg.padding` carried
per-side classes (`pt-lg-8`/`pe-lg-5`/`pb-lg-4`/`ps-lg-4`); **`content_bg`** = `bg-{slug}` compact,
**`content_color`** = `text-{slug}` compact; alignment fields (`vertical_align`=`align-items-*`,
`content_align`/`stack_image_align`=`left|center|right`), `gap` = scale slug `"4"`, unit-inputs
`{value,unit}`. §3 generals (selector-token `custom_css`, `responsive_hide` map) re-confirmed. This
also validates end-to-end that the editor-load **data-loss guard** + the column-split swap round-trip
cleanly. No version bump (docs-only).

**2026-06-10 — image export (`image-test-section-ca2a301e.json`, 2.10.26):** trained `media_image`
(atom `media_image`, folder `media-image`). 2 images. Its `AGENTS.md` was already accurate (no
drift) — added a verified snippet pinning: `image` = `{attachment_id,url}` (the Media-Library
reference — the conversion media phase ends here: Site-Converter-fetch → reference by new id/url),
`width`/`height` = `{value,unit}`, `bg_color` = compact `{predefined:"bg-{slug}"|"",custom:hex|""}`.
Re-confirmed the §3 generals (`custom_css` `selector` token, `spacing.advanced` breakpoint map,
`responsive_hide` map). No version bump (docs-only).

**2026-06-10 — button export (`button-test-section-6f2a34c9.json`, 2.10.26):** trained `button`
(was pending). 5 buttons exercising every att. Updated `button/AGENTS.md` with a verified snippet +
fixed its generator example, which wrongly showed `icon` as a string — `icon` is an **icon-v2
object** (`{type:"none"}` / `{type:"icon-font",icon-class,icon-class-without-root,pack-name,pack-css-uri}`
/ `{type:"custom-upload",attachment-id,url}`). Also pinned: `label` accepts inline HTML/SVG; `style`
= `btn-{slug}`/`-outline`/`btn-gradient`, `size` = `btn-{xs..xl}`; `width` = `{mode,custom:{custom_width:{value,unit}}}`;
`state` = `active|disabled`; `hover_animation` = `.btnfx-*` / `btnfx-c-{slug}`. **Two general
findings** (now in §3, apply to all shortcodes): `spacing.advanced` is a `{<bp>:{margin,padding}}`
responsive-class map when set (not just `[]`), and `custom_attrs` populates as `[{name,value}]`.
No version bump (docs-only).

**2026-06-10 — full-page export (`payforit-homepage-full-a86dca2d.json`, 2.10.23):** a real
production homepage (the PayForItUK conversion of an AI-generated HTML site; first training data at
the 2.10.x line). Refreshed §3: **section** atts gained `min_height` (multi-picker
`{preset,custom:{custom_height:{value,unit}}}`), `content_valign`, and a full background-pro
**`background`** object (alongside the legacy `bg_color`/`background_image`); **column** atts gained
the per-device `w_phone`/`w_tablet`/`w_desktop`, `offset_*`, `align_self`, `content_v`/`content_h`,
`position`, `z_index`, `border_preset`, `mobile_order`. Both are supersets — older exports omit them
and the importer fills defaults. Other findings (no atts change): **`special_heading.title` carries
inline HTML**; **`custom_css` was used 0× across 96 items** — all styling rode on global CSS keyed by
preserved class names (`pfu-*`, `hero-sub`, `method-tile`, …), the pattern now in the conversion
contract §0.4. Two domain shortcodes (`casino_finder`, `reviews_table`) noted above. No outstanding
gaps for the verified atoms.

**2026-06-03 — full-page export (`sample-full-page-template-full-7e26f8f2.json`, 2.8.47):** bumped
`format_version` 1 → 2 (informational only). Revealed three shared shapes now documented in §3 that
the v1 verification missed: `custom_css` (a common per-item `group_css` field using the `selector`
token), `responsive_hide` as a `{"hide-*":true}` map when set (not just `[]`), and `background_image`
as an image-picker **object** (not `""`). No new leaf atts — `title_class`/`subtitle_class`/
`font_size_preset` were already in their shortcode tables. No gaps outstanding.

**2026-06-03 — section export (`payment-method-section-6e4d05fe.json`, 2.8.49):** the canonical
`icon_box` capture (table in icon-box/AGENTS.md was already accurate; this verified it + pinned the
serialized shapes). Findings, now in icon-box/AGENTS.md "Verified `atts` (real export)": `icon`
always serializes as an **object** (`{"type":"none"}` when unused), `custom_icon` holds inline SVG
(quotes backslash-escaped) and overrides it, and the `mobile_stack`/`link_target` switches encode as
JSON **booleans** (`true`/`false`) — unlike the `"yes"`/`"no"` switches elsewhere. Also confirmed an
equal-width tile row = sibling `1_4` columns each wrapping one leaf (`icon_box` has no multi-tile
mode), and `icon_color.predefined` = `text-{slug}` preset / `icon_badge_color.custom` = hex. No new
atts; no gaps. `button`/`code_block`/`table` still pending.

**2026-06-03 — section export (`test-section-section-00a35c97.json`, 2.8.48):** confirmed a
`kind:"section"` export's `json` is a **single object** (not an array — §1 now states the shape per
kind). Re-verified `responsive_hide:{"hide-md":true}`, `animation.enable:"yes"`, and
`bg_color.predefined:"bg-yellow"` (preset `bg-{slug}` class — §3 noted). Captured the **DRY
section-scoped CSS pattern**: one `custom_css` on the section (`selector .nbs-step{…}`) + `nbs-step`
in each column's `css_class`, instead of repeating `custom_css` per column — keeps the generated
stylesheet small. No new atts; no gaps.
