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
		'1_2': 6, '5_12': 5, '1_3': 4, '1_4': 3, '1_5': 2.4, '1_6': 2, '1_12': 1
	};
	function frOf( w ) { return FR[ w ] || 12; }

	function rep( w, n ) { var a = []; for ( var i = 0; i < n; i++ ) { a.push( w ); } return a; }

	// twelfths -> a valid column width (used to insert masonry blocks as columns).
	var W12 = {
		1: '1_12', 2: '1_6', 3: '1_4', 4: '1_3', 5: '5_12', 6: '1_2',
		7: '7_12', 8: '2_3', 9: '3_4', 10: '5_6', 11: '11_12', 12: '1_1'
	};

	var CATALOG = [
		{ name: l10n.equal || 'Equal Columns', kind: 'flat', section: 'section', layouts: [
			[ '1_1' ],
			[ '1_2', '1_2' ],
			rep( '1_3', 3 ),
			rep( '1_4', 4 ),
			rep( '1_5', 5 ),
			rep( '1_6', 6 ),
			rep( '1_12', 12 )
		] },
		{ name: l10n.offset || 'Offset & Sidebar', kind: 'flat', section: 'section', layouts: [
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
		{ name: l10n.multirow || 'Multi-Row', kind: 'flat', section: 'section', layouts: [
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
		{ name: l10n.multicolumn || 'Multi-Column', kind: 'nested', section: 'section', layouts: [
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

	function simpleCol( w ) { return { type: 'column', width: w, atts: {}, _items: [] }; }

	function buildCell( cell ) {
		if ( typeof cell === 'string' ) { return simpleCol( cell ); }
		var inner = [];
		for ( var r = 0; r < ( cell.rows || [] ).length; r++ ) {
			for ( var c = 0; c < cell.rows[ r ].length; c++ ) { inner.push( simpleCol( cell.rows[ r ][ c ] ) ); }
		}
		return { type: 'column', width: cell.w, atts: {}, _items: inner };
	}

	function buildTree( cat, layout ) {
		var items;
		if ( cat.kind === 'masonry' ) {
			items = layout.map( function ( s ) { return simpleCol( W12[ s ] || '1_1' ); } );
		}
		else if ( cat.kind === 'nested' ) { items = layout.map( buildCell ); }
		else { items = layout.map( simpleCol ); }
		return { type: cat.section, atts: {}, _items: items };
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

					grid += '<button type="button" class="upb-is-card" data-cat="' + i + '" data-layout="' + j + '">' +
						'<span class="' + thumbCls + '"' + style + '>' + thumb + '</span></button>';
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

		_.defer( function () {
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
		} );
	} );

} )( jQuery, fwEvents, _, typeof _fw_page_builder_insert_section !== 'undefined' ? _fw_page_builder_insert_section : {} );
