/**
 * Insert Section — a prebuilt-layout inserter for the page builder.
 *
 * Adds an "Insert Section" link to the builder header toolbar (before Templates)
 * that opens a modal whose TABS are the layout categories. Clicking a layout
 * appends a new section, pre-filled with those columns, to the END of the page.
 *
 * Insertion is the same primitive the Templates "Add From Library" uses:
 *   builder.rootItems.add({ type:'section', _items:[ {type:'column', width, …}, … ] })
 * The collection's model factory + createItemsFromJSON recurse the tree into live
 * items, so each layout is just a small JSON spec.
 *
 * Three layout KINDS (cat.kind):
 *   - 'flat'    : an array of column widths; columns wrap into rows by width.
 *   - 'nested'  : an array of cells; a cell is a width string OR
 *                 { w:<outer width>, rows:[ [<inner widths>], … ] } — an outer
 *                 column that itself holds sub-rows of columns (column-in-column,
 *                 one level deep). Used by Multi-Column.
 *   - 'masonry' : { tracks:N, cols:[…] } — inserted into a masonry_section.
 *
 * Injection mirrors section-sorter.js: listen to fw:option-type:builder:init,
 * guard the page-builder type, append into data.$headerTools. Editor-only.
 */
( function ( $, fwe, _, localized ) {
	'use strict';

	var l10n = ( localized && localized.l10n ) || {};

	// Column width -> twelfths, for thumbnail proportions / row wrapping.
	var FR = {
		'1_1': 12, '11_12': 11, '5_6': 10, '3_4': 9, '2_3': 8, '7_12': 7,
		'1_2': 6, '5_12': 5, '1_3': 4, '1_4': 3, '1_6': 2, '1_12': 1,
		// Fifths as twelfths-equivalent widths (k/5 * 12), so their thumbnail bars are proportioned
		// correctly next to the twelfths (previously only 1_5 was mapped; 2_5/3_5/4_5 fell back to full).
		'1_5': 2.4, '2_5': 4.8, '3_5': 7.2, '4_5': 9.6,
		// Equal-only Nths (7…11): 12/N each, so N cells fill one thumbnail row. Used only as the
		// per-cell placeholder for a 1/N × N equal grid (the cell width itself is unused — the grid's
		// N tracks size the cells).
		'1_7': 1.714, '1_8': 1.5, '1_9': 1.333, '1_10': 1.2, '1_11': 1.091
	};
	function frOf( w ) { return FR[ w ] || 12; }

	function rep( w, n ) { var a = []; for ( var i = 0; i < n; i++ ) { a.push( w ); } return a; }

	// twelfths -> a valid column width (used to insert masonry blocks as columns).
	var W12 = {
		1: '1_12', 2: '1_6', 3: '1_4', 4: '1_3', 5: '5_12', 6: '1_2',
		7: '7_12', 8: '2_3', 9: '3_4', 10: '5_6', 11: '11_12', 12: '1_1'
	};

	var CATALOG = [
		{ name: l10n.equal || 'Equal Columns', kind: 'flat', equal: true, section: 'flexbox', layouts: [
			[ '1_1' ],
			[ '1_2', '1_2' ],
			rep( '1_3', 3 ),
			rep( '1_4', 4 ),
			rep( '1_5', 5 ),
			rep( '1_6', 6 ),
			rep( '1_12', 12 )
		] },
		{ name: l10n.offset || 'Offset & Sidebar', kind: 'flat', section: 'flexbox', layouts: [
			[ '2_3', '1_3' ], [ '1_3', '2_3' ],
			[ '3_4', '1_4' ], [ '1_4', '3_4' ],
			[ '5_6', '1_6' ], [ '1_6', '5_6' ],
			[ '7_12', '5_12' ], [ '5_12', '7_12' ],
			[ '11_12', '1_12' ], [ '1_12', '11_12' ],
			[ '1_2', '1_4', '1_4' ], [ '1_4', '1_4', '1_2' ], [ '1_4', '1_2', '1_4' ],
			[ '1_6', '2_3', '1_6' ],
			[ '1_2', '1_3', '1_6' ], [ '1_6', '1_3', '1_2' ],
			[ '1_2', '1_6', '1_6', '1_6' ], [ '1_6', '1_6', '1_6', '1_2' ],
			// Sidebar layouts (a full-width header/footer row + a content/sidebar row).
			[ '1_1', '3_4', '1_4' ], [ '1_1', '1_4', '3_4' ],
			[ '1_1', '2_3', '1_3' ], [ '1_1', '1_3', '2_3' ],
			[ '3_4', '1_4', '1_1' ], [ '1_4', '3_4', '1_1' ],
			[ '2_3', '1_3', '1_1' ], [ '1_3', '2_3', '1_1' ],
			// Two-row mixed offsets (mirrored / offset-over-equal) to balance the modal.
			[ '3_4', '1_4', '1_4', '3_4' ], [ '1_3', '2_3', '2_3', '1_3' ],
			[ '2_3', '1_3', '1_2', '1_2' ], [ '1_2', '1_2', '1_4', '3_4' ],
			// Three-row sidebar: full header + content/sidebar middle + full footer.
			[ '1_1', '3_4', '1_4', '1_1' ], [ '1_1', '1_4', '3_4', '1_1' ],
			[ '1_1', '2_3', '1_3', '1_1' ], [ '1_1', '1_3', '2_3', '1_1' ],
			[ '1_1', '1_4', '1_2', '1_4', '1_1' ], [ '1_1', '1_3', '1_3', '1_3', '1_1' ]
		] },
		{ name: l10n.multirow || 'Multi-Row', kind: 'flat', section: 'flexbox', layouts: [
			[ '1_1', '1_1' ],
			[ '1_1', '1_1', '1_1' ],
			[ '1_1', '1_2', '1_2' ],
			[ '1_2', '1_2', '1_1' ],
			[ '1_2', '1_2', '1_2', '1_2' ],
			[ '1_1', '1_3', '1_3', '1_3' ],
			[ '1_3', '1_3', '1_3', '1_1' ],
			rep( '1_3', 6 ),
			[ '1_2', '1_2', '1_3', '1_3', '1_3' ],
			[ '1_3', '1_3', '1_3', '1_2', '1_2' ],
			[ '1_4', '1_4', '1_4', '1_4', '1_2', '1_2' ],
			[ '1_2', '1_2', '1_4', '1_4', '1_4', '1_4' ],
			[ '1_1', '1_2', '1_2', '1_3', '1_3', '1_3' ],
			[ '2_3', '1_3', '1_3', '2_3' ],
			// Offset zigzag: narrow-left/wide-right over wide-left/narrow-right.
			[ '5_12', '7_12', '7_12', '5_12' ],
			[ '1_1', '1_4', '1_4', '1_4', '1_4' ],
			[ '1_4', '1_4', '1_4', '1_4', '1_1' ]
		] },
		{ name: l10n.multicolumn || 'Multi-Column', kind: 'nested', section: 'flexbox', layouts: [
			[ { w: '1_4' }, { w: '3_4', rows: [ [ '1_2', '1_2' ], [ '1_1' ] ] } ],
			[ { w: '3_4', rows: [ [ '1_1' ], [ '1_2', '1_2' ] ] }, { w: '1_4' } ],
			[ { w: '1_3' }, { w: '2_3', rows: [ [ '1_2', '1_2' ], [ '1_3', '1_3', '1_3' ] ] } ],
			[ { w: '2_3', rows: [ [ '1_1' ], [ '1_2', '1_2' ] ] }, { w: '1_3' } ],
			[ { w: '1_2', rows: [ [ '1_1' ], [ '1_1' ] ] }, { w: '1_2', rows: [ [ '1_2', '1_2' ] ] } ],
			[ { w: '1_2', rows: [ [ '1_2', '1_2' ] ] }, { w: '1_2', rows: [ [ '1_2', '1_2' ] ] } ],
			[ { w: '1_4' }, { w: '1_2', rows: [ [ '1_1' ], [ '1_2', '1_2' ] ] }, { w: '1_4' } ],
			[ { w: '1_2', rows: [ [ '1_1' ], [ '1_3', '1_3', '1_3' ] ] }, { w: '1_2' } ],
			[ { w: '1_3', rows: [ [ '1_1' ], [ '1_1' ] ] }, { w: '1_3', rows: [ [ '1_1' ], [ '1_1' ] ] }, { w: '1_3', rows: [ [ '1_1' ], [ '1_1' ] ] } ],
			[ { w: '3_4', rows: [ [ '1_3', '1_3', '1_3' ] ] }, { w: '1_4' } ],
			[ { w: '1_4' }, { w: '3_4', rows: [ [ '1_4', '1_4', '1_4', '1_4' ] ] } ],
			[ { w: '1_2', rows: [ [ '1_2', '1_2' ], [ '1_1' ] ] }, { w: '1_2', rows: [ [ '1_1' ], [ '1_2', '1_2' ] ] } ]
		] },
		{ name: l10n.masonry || 'Masonry', kind: 'masonry', section: 'masonry_section', layouts: [
			// Mixed-width columns that flex-wrap into a staggered (masonry) grid.
			// Each number is a column span in twelfths; the thumbnail renders them
			// the SAME way the masonry_section lays them out (sequential 12-col wrap,
			// equal height, gaps where a column doesn't fill the row) — so the
			// preview matches the inserted result exactly.
			[ 12, 4, 4, 4, 6, 6 ],
			[ 6, 6, 3, 3, 4, 4, 4 ],
			[ 8, 4, 6, 6, 4, 4, 4 ],
			[ 4, 4, 4, 8, 4, 6, 6 ],
			[ 3, 3, 6, 4, 4, 4, 6, 6 ],
			[ 6, 3, 3, 6, 6, 3, 3, 6 ],
			[ 4, 8, 4, 4, 4, 12 ],
			[ 3, 3, 3, 3, 6, 3, 3, 6, 6 ],
			[ 8, 4, 4, 4, 4, 8, 4 ],
			[ 6, 6, 3, 3, 3, 3, 6, 6 ],
			[ 12, 6, 6, 4, 4, 4 ],
			[ 4, 4, 4, 4, 4, 4, 6, 6 ]
		] }
	];

	// --- Thumbnail builders --------------------------------------------------

	// Group a flat width list into visual rows that each fill ~12/12.
	function rowsFromCols( cols ) {
		var rows = [], cur = [], sum = 0;
		for ( var i = 0; i < cols.length; i++ ) {
			var f = frOf( cols[ i ] );
			if ( sum + f > 12.4 && cur.length ) { rows.push( cur ); cur = []; sum = 0; }
			cur.push( cols[ i ] ); sum += f;
		}
		if ( cur.length ) { rows.push( cur ); }
		return rows;
	}

	function bar( w ) { return '<i class="upb-is-bar" style="flex:' + frOf( w ) + ' 0 0"></i>'; }

	function thumbFlat( cols ) {
		var rows = rowsFromCols( cols ), html = '';
		for ( var r = 0; r < rows.length; r++ ) {
			html += '<span class="upb-is-row">';
			for ( var c = 0; c < rows[ r ].length; c++ ) { html += bar( rows[ r ][ c ] ); }
			html += '</span>';
		}
		return html;
	}

	// Nested: one row of outer cells; a nested cell shows its own sub-rows.
	function thumbNested( cells ) {
		var html = '<span class="upb-is-row">';
		for ( var i = 0; i < cells.length; i++ ) {
			var cell = cells[ i ];
			if ( typeof cell === 'string' ) { html += bar( cell ); continue; }
			html += '<span class="upb-is-col" style="flex:' + frOf( cell.w ) + ' 0 0">';
			for ( var r = 0; r < ( cell.rows || [] ).length; r++ ) {
				html += '<span class="upb-is-subrow">';
				for ( var c = 0; c < cell.rows[ r ].length; c++ ) { html += bar( cell.rows[ r ][ c ] ); }
				html += '</span>';
			}
			html += '</span>';
		}
		return html + '</span>';
	}

	// Masonry: equal-height columns spanning `s` twelfths, laid out in a sequential
	// 12-col grid (no row-spans, no dense backfill) so the preview wraps EXACTLY
	// like the inserted masonry_section's empty columns.
	function thumbMasonry( spans ) {
		var html = '';
		for ( var i = 0; i < spans.length; i++ ) {
			html += '<i class="upb-is-mb" style="grid-column:span ' + spans[ i ] + '"></i>';
		}
		return html;
	}

	// --- Tree builders -------------------------------------------------------

	function uid() { return 'fx' + Math.random().toString( 36 ).slice( 2, 10 ); }

	// Classic column — used only by the masonry_section, which stays a classic shortcode.
	// Compact fraction-sum caption for a layout tile: "1/2 + 1/2", "1/3 + 2/3",
	// "1/4 + 1/2 + 1/4", or "1/6 × 6" for a long equal row. Cells may be width
	// strings or nested { w } objects; the underscore in a width key becomes a slash.
	function fracOf( w ) { return String( w ).replace( '_', '/' ); }
	function layoutLabel( layout ) {
		var ws = layout.map( function ( c ) { return ( typeof c === 'string' ) ? c : c.w; } );
		var eq = ws.every( function ( w ) { return w === ws[ 0 ]; } );
		if ( eq && ws.length >= 4 ) { return fracOf( ws[ 0 ] ) + ' × ' + ws.length; }
		return ws.map( fracOf ).join( ' + ' );
	}

	function simpleCol( w ) { return { type: 'column', width: w, atts: {}, _items: [] }; }

	// The flexbox Width value for a column width: a twelfths preset (fw-span) when it divides the
	// 12-col grid cleanly, else an exact % (a 1/5 column -> 20%). EVERY cell gets a Width so the
	// builder canvas lays them out side-by-side (it sizes cells by their Width, not by CSS grid).
	function widthAtt( w ) {
		var fr = frOf( w ), span = Math.round( fr );
		if ( Math.abs( fr - span ) < 0.01 && span >= 1 && span <= 12 ) {
			return { base: { preset: String( span ) }, md: { preset: 'none' }, lg: { preset: 'none' } };
		}
		var pct = Math.round( ( fr / 12 ) * 10000 ) / 100; // 1/5 -> 20
		return { base: { preset: 'custom', custom: { width_custom: { value: String( pct ), unit: '%' } } }, md: { preset: 'none' }, lg: { preset: 'none' } };
	}

	// A modern Div cell sized to width `w`. `inner`, if given, makes it a flex row of sub-cells
	// (column-in-column); the sub-cells carry their own Widths and wrap into sub-rows.
	function divCell( w, inner ) {
		var atts = { html_tag: 'div', unique_id: uid(), width: widthAtt( w ) };
		if ( inner && inner.length ) { atts.display = 'flex'; }
		return { type: 'flexbox', atts: atts, _items: inner || [] };
	}

	function buildCell( cell ) {
		if ( typeof cell === 'string' ) { return divCell( cell, null ); }
		var inner = [];
		for ( var r = 0; r < ( cell.rows || [] ).length; r++ ) {
			for ( var c = 0; c < cell.rows[ r ].length; c++ ) { inner.push( divCell( cell.rows[ r ][ c ], null ) ); }
		}
		return divCell( cell.w, inner );
	}

	function buildTree( cat, layout ) {
		// Masonry stays a classic masonry_section (its own staggered flex layout).
		if ( cat.kind === 'masonry' ) {
			return { type: cat.section, atts: {}, _items: layout.map( function ( s ) { return simpleCol( W12[ s ] || '1_1' ); } ) };
		}
		// Every other tab -> a Flexbox Section (a row that wraps) whose cells carry their Width.
		// Equal columns are just equal Widths; multi-row layouts wrap onto new rows; nested cells
		// are flex rows of their own sub-cells.
		var items = ( cat.kind === 'nested' )
			? layout.map( buildCell )
			: layout.map( function ( w ) { return divCell( w, null ); } );
		return { type: 'flexbox', atts: { html_tag: 'section', display: 'flex', unique_id: uid() }, _items: items };
	}

	function escapeHtml( s ) {
		return String( s == null ? '' : s ).replace( /[&<>"']/g, function ( m ) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ m ];
		} );
	}

	$( document.body ).on( 'fw:option-type:builder:init', function ( e, data ) {
		if ( ! data || ! data.builder || data.builder.get( 'type' ) !== 'page-builder' ) {
			return;
		}

		var builder = data.builder;
		var $headerTools = data.$headerTools;
		var $modal = null;

		// Only offer a category whose section type is registered (e.g. the Masonry
		// Section shortcode could be disabled), so we never insert a broken item.
		function availableCatalog() {
			return CATALOG.filter( function ( cat ) {
				return !! builder.getRegisteredItemClassByType( cat.section );
			} );
		}

		function renderModal() {
			var cats = availableCatalog();
			var tabs = '', panels = '';

			for ( var i = 0; i < cats.length; i++ ) {
				var cat = cats[ i ];
				tabs += '<button type="button" class="upb-is-tab' + ( i === 0 ? ' is-active' : '' ) +
					'" data-tab="' + i + '">' + escapeHtml( cat.name ) + '</button>';

				var grid = '';
				for ( var j = 0; j < cat.layouts.length; j++ ) {
					var layout = cat.layouts[ j ], thumbCls = 'upb-is-thumb', thumb, style = '';

					if ( cat.kind === 'masonry' ) {
						thumbCls += ' is-masonry';
						thumb = thumbMasonry( layout );
					} else if ( cat.kind === 'nested' ) {
						thumbCls += ' is-nested';
						thumb = thumbNested( layout );
					} else {
						// Grow the thumb with the row count so multi-row layouts (e.g.
						// 3-row sidebars) aren't squished; keep 1–2 row thumbs at 64px.
						var rc = rowsFromCols( layout ).length;
						style = ' style="height:' + Math.max( 64, rc * 30 + ( rc - 1 ) * 5 ) + 'px"';
						thumb = thumbFlat( layout );
					}

					var label = ( cat.kind === 'masonry' )
						? ( layout.length + ' ' + ( l10n.blocks || 'blocks' ) )
						: layoutLabel( layout );
					grid += '<button type="button" class="upb-is-card" data-cat="' + i + '" data-layout="' + j + '">' +
						'<span class="' + thumbCls + '"' + style + '>' + thumb + '</span>' +
						'<span class="upb-is-label">' + escapeHtml( label ) + '</span></button>';
				}
				panels += '<div class="upb-is-panel' + ( i === 0 ? ' is-active' : '' ) +
					'" data-panel="' + i + '"><div class="upb-is-grid">' + grid + '</div></div>';
			}

			$modal = $(
				'<div class="upb-is-overlay" role="dialog" aria-modal="true" aria-label="' +
					escapeHtml( l10n.title || 'Insert Section' ) + '">' +
					'<div class="upb-is-modal">' +
						'<div class="upb-is-head">' +
							'<h2>' + escapeHtml( l10n.title || 'Insert Section' ) + '</h2>' +
							'<button type="button" class="upb-is-close" aria-label="' +
								escapeHtml( l10n.close || 'Close' ) + '">&times;</button>' +
						'</div>' +
						'<div class="upb-is-tabs">' + tabs + '</div>' +
						'<div class="upb-is-body">' + panels + '</div>' +
					'</div>' +
				'</div>'
			);

			$modal.on( 'click', '.upb-is-tab', function () {
				var t = $( this ).attr( 'data-tab' );
				$modal.find( '.upb-is-tab' ).removeClass( 'is-active' );
				$( this ).addClass( 'is-active' );
				$modal.find( '.upb-is-panel' ).removeClass( 'is-active' );
				$modal.find( '.upb-is-panel[data-panel="' + t + '"]' ).addClass( 'is-active' );
				$modal.find( '.upb-is-body' ).scrollTop( 0 );
			} );

			$modal.on( 'click', function ( ev ) { if ( ev.target === $modal[ 0 ] ) { close(); } } );
			$modal.find( '.upb-is-close' ).on( 'click', close );

			$modal.on( 'click', '.upb-is-card', function () {
				var cat = cats[ + $( this ).attr( 'data-cat' ) ];
				var layout = cat.layouts[ + $( this ).attr( 'data-layout' ) ];
				builder.rootItems.add( buildTree( cat, layout ) ); // append to end
				close();
			} );

			$( 'body' ).append( $modal );
		}

		function open() {
			if ( ! $modal ) { renderModal(); }
			$modal.addClass( 'is-open' );
			$( document ).on( 'keydown.upbIs', function ( ev ) { if ( ev.keyCode === 27 ) { close(); } } );
		}

		function close() {
			if ( $modal ) { $modal.removeClass( 'is-open' ); }
			$( document ).off( 'keydown.upbIs' );
		}

		setTimeout( function () {
			var $link = $(
				'<div class="insert-section-container fw-pull-right">' +
					'<a class="insert-section-btn" href="#" onclick="return false;">' +
						'<i class="dashicons dashicons-plus-alt2"></i>' +
						escapeHtml( l10n.link || 'Insert Section' ) +
					'</a>' +
				'</div>'
			);
			$headerTools.removeClass( 'fw-hidden' ).append( $link );
			$link.find( '.insert-section-btn' ).on( 'click', function ( ev ) {
				ev.preventDefault();
				open();
			} );
		} , 0);

		// ---- Grid tile -> "Insert Grid" column picker --------------------------------
		// Clicking the palette Grid tile opens a compact picker (reusing this modal's chrome +
		// thumbnails) instead of dropping an empty grid. Picking a layout inserts a Grid Div,
		// nested into the last Section (per the sections-at-root model). The plain Flexbox tile
		// is unaffected — it still drops an empty flex container to fill by hand.
		var $gridModal = null;
		// Insert Grid layouts, grouped for the picker (Equal / 2-col / 3-col / 4-col), covering
		// equal columns plus uneven twelfths AND fifths splits. Flattened into GRID_LAYOUTS so the
		// click handler can index a tile by a single running number.
		var GRID_GROUPS = [
			{ name: l10n.g_equal || 'Equal', layouts: [
				[ '1_2', '1_2' ], rep( '1_3', 3 ), rep( '1_4', 4 ), rep( '1_5', 5 ), rep( '1_6', 6 ),
				rep( '1_7', 7 ), rep( '1_8', 8 ), rep( '1_9', 9 ), rep( '1_10', 10 ), rep( '1_11', 11 ), rep( '1_12', 12 )
			] },
			{ name: l10n.g_two || 'Two columns', layouts: [
				// Every twelfths split (a + 12-a) and its mirror, then the fifths splits.
				[ '1_3', '2_3' ], [ '2_3', '1_3' ], [ '1_4', '3_4' ], [ '3_4', '1_4' ],
				[ '1_6', '5_6' ], [ '5_6', '1_6' ], [ '1_12', '11_12' ], [ '11_12', '1_12' ],
				[ '5_12', '7_12' ], [ '7_12', '5_12' ],
				[ '2_5', '3_5' ], [ '3_5', '2_5' ], [ '1_5', '4_5' ], [ '4_5', '1_5' ]
			] },
			{ name: l10n.g_three || 'Three columns', layouts: [
				// Symmetric (wide centre / wide sides), then sidebar splits, then fifths.
				[ '1_4', '1_2', '1_4' ], [ '1_6', '2_3', '1_6' ], [ '1_12', '5_6', '1_12' ], [ '5_12', '1_6', '5_12' ],
				[ '1_2', '1_4', '1_4' ], [ '1_4', '1_4', '1_2' ], [ '2_3', '1_6', '1_6' ], [ '1_6', '1_6', '2_3' ],
				[ '1_2', '1_3', '1_6' ], [ '1_6', '1_3', '1_2' ],
				[ '1_5', '3_5', '1_5' ], [ '2_5', '1_5', '2_5' ], [ '3_5', '1_5', '1_5' ], [ '1_5', '1_5', '3_5' ]
			] },
			{ name: l10n.g_four || 'Four columns', layouts: [
				[ '1_2', '1_6', '1_6', '1_6' ], [ '1_6', '1_6', '1_6', '1_2' ],
				[ '1_6', '1_3', '1_3', '1_6' ], [ '1_3', '1_6', '1_6', '1_3' ],
				[ '1_12', '5_12', '5_12', '1_12' ], [ '1_2', '1_4', '1_6', '1_12' ],
				[ '1_12', '1_6', '1_4', '1_2' ], [ '3_4', '1_12', '1_12', '1_12' ]
			] },
			{ name: l10n.g_five || 'Five columns', layouts: [
				// A feature column among fifth/sixth cells (each row still totals a whole).
				[ '1_3', '1_6', '1_6', '1_6', '1_6' ], [ '1_6', '1_6', '1_6', '1_6', '1_3' ],
				[ '1_6', '1_6', '1_3', '1_6', '1_6' ], [ '1_4', '1_4', '1_6', '1_6', '1_6' ],
				[ '1_6', '1_6', '1_6', '1_4', '1_4' ]
			] }
		];
		var GRID_LAYOUTS = [];
		GRID_GROUPS.forEach( function ( g ) { g.layouts.forEach( function ( l ) { GRID_LAYOUTS.push( l ); } ); } );

		// A Grid Div for a column layout. Equal columns -> an N-track grid whose cells carry NO width:
		// the grid tracks size them, so the front end stays clean (no redundant per-cell width fighting
		// the grid, no per-cell <style>). The canvas, which previews with flex rather than CSS grid,
		// distributes width-less grid children equally via flex:1 1 0. Uneven twelfths -> a 12-track
		// spanning grid with fw-span cells (a shared, cacheable class). Uneven FIFTHS (2/5, 3/5, …)
		// don't reduce to a clean twelfths span, so they emit a FLEX row whose cells carry the fifth
		// PRESET (1_5…4_5) — the view turns that into a shared fw-col-N class, not a per-cell <style>.
		function buildGridDiv( layout ) {
			var allEqual = layout.every( function ( w ) { return w === layout[ 0 ]; } );
			var hasFifth = layout.some( function ( w ) { return /_5$/.test( w ); } );
			if ( allEqual ) {
				var n = layout.length, eqItems = [];
				for ( var i = 0; i < n; i++ ) {
					eqItems.push( { type: 'flexbox', _items: [], atts: { html_tag: 'div', unique_id: uid() } } );
				}
				return { type: 'flexbox', atts: { html_tag: 'div', display: 'grid', grid_columns: String( n ), unique_id: uid() }, _items: eqItems };
			}
			if ( hasFifth ) {
				var fxItems = layout.map( function ( w ) {
					return { type: 'flexbox', _items: [], atts: { html_tag: 'div', unique_id: uid(),
						width: { base: { preset: w }, md: { preset: 'none' }, lg: { preset: 'none' } } } };
				} );
				return { type: 'flexbox', atts: { html_tag: 'div', display: 'flex', unique_id: uid() }, _items: fxItems };
			}
			return { type: 'flexbox', atts: { html_tag: 'div', display: 'grid', grid_columns: '12', unique_id: uid() }, _items: layout.map( function ( w ) { return divCell( w, null ); } ) };
		}
		function insertGrid( layout ) {
			var section = ( typeof builder.ensureFlexboxSection === 'function' ) ? builder.ensureFlexboxSection() : null;
			var target = ( section && section.get ) ? section.get( '_items' ) : builder.rootItems;
			target.add( buildGridDiv( layout ) );
		}
		function closeGrid() {
			if ( $gridModal ) { $gridModal.removeClass( 'is-open' ); }
			$( document ).off( 'keydown.upbGrid' );
		}
		function openGrid() {
			if ( ! $gridModal ) {
				// One TAB per group (Equal / Two / Three / Four / Five columns), mirroring the Insert
				// Section modal. Cards keep a running data-gl index into the flat GRID_LAYOUTS.
				var tabs = '', panels = '', gi = 0;
				for ( var gg = 0; gg < GRID_GROUPS.length; gg++ ) {
					var grp = GRID_GROUPS[ gg ];
					tabs += '<button type="button" class="upb-is-tab' + ( gg === 0 ? ' is-active' : '' ) +
						'" data-tab="' + gg + '">' + escapeHtml( grp.name ) + '</button>';
					var cards = '';
					for ( var k = 0; k < grp.layouts.length; k++ ) {
						var gl = grp.layouts[ k ];
						cards += '<button type="button" class="upb-is-card" data-gl="' + gi + '">' +
							'<span class="upb-is-thumb">' + thumbFlat( gl ) + '</span>' +
							'<span class="upb-is-label">' + escapeHtml( layoutLabel( gl ) ) + '</span></button>';
						gi++;
					}
					panels += '<div class="upb-is-panel' + ( gg === 0 ? ' is-active' : '' ) +
						'" data-panel="' + gg + '"><div class="upb-is-grid">' + cards + '</div></div>';
				}
				$gridModal = $(
					'<div class="upb-is-overlay" role="dialog" aria-modal="true" aria-label="' + escapeHtml( l10n.grid_title || 'Insert Grid' ) + '">' +
						'<div class="upb-is-modal">' +
							'<div class="upb-is-head"><h2>' + escapeHtml( l10n.grid_title || 'Insert Grid' ) + '</h2>' +
								'<button type="button" class="upb-is-close" aria-label="' + escapeHtml( l10n.close || 'Close' ) + '">&times;</button></div>' +
							'<div class="upb-is-tabs">' + tabs + '</div>' +
							'<div class="upb-is-body">' + panels + '</div>' +
						'</div>' +
					'</div>'
				);
				$gridModal.on( 'click', function ( ev ) { if ( ev.target === $gridModal[ 0 ] ) { closeGrid(); } } );
				$gridModal.find( '.upb-is-close' ).on( 'click', closeGrid );
				$gridModal.on( 'click', '.upb-is-tab', function () {
					var t = $( this ).attr( 'data-tab' );
					$gridModal.find( '.upb-is-tab' ).removeClass( 'is-active' );
					$( this ).addClass( 'is-active' );
					$gridModal.find( '.upb-is-panel' ).removeClass( 'is-active' );
					$gridModal.find( '.upb-is-panel[data-panel="' + t + '"]' ).addClass( 'is-active' );
					$gridModal.find( '.upb-is-body' ).scrollTop( 0 );
				} );
				$gridModal.on( 'click', '.upb-is-card', function () {
					insertGrid( GRID_LAYOUTS[ + $( this ).attr( 'data-gl' ) ] );
					closeGrid();
				} );
				$( 'body' ).append( $gridModal );
			}
			$gridModal.addClass( 'is-open' );
			$( document ).on( 'keydown.upbGrid', function ( ev ) { if ( ev.keyCode === 27 ) { closeGrid(); } } );
		}
		// Intercept the Grid tile's click in the CAPTURE phase, before the builder's own
		// thumbnail-click handler drops an empty grid.
		setTimeout( function () {
			var rootEl = ( $headerTools.closest( '.fw-option-type-builder' )[ 0 ] ) || document;
			rootEl.addEventListener( 'click', function ( ev ) {
				var tile = ( ev.target && ev.target.closest ) ? ev.target.closest( '.builder-item-type' ) : null;
				if ( ! tile ) { return; }
				var d = tile.querySelector( '.item-data' );
				if ( ! d || d.getAttribute( 'data-fxdisplay' ) !== 'grid' ) { return; }
				ev.preventDefault();
				ev.stopPropagation();
				if ( ev.stopImmediatePropagation ) { ev.stopImmediatePropagation(); }
				openGrid();
			}, true );
		}, 0 );
	} );

} )( jQuery, fwEvents, _, typeof _fw_page_builder_insert_section !== 'undefined' ? _fw_page_builder_insert_section : {} );
