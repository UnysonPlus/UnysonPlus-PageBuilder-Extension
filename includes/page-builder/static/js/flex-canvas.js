/**
 * Page-builder canvas modernization — tag column rows for the flexbox layout.
 *
 * A canvas column item is a `.builder-item` whose root child is the column view's
 * `.pb-item-type-column`. Every builder container shares `.builder-items.fw-row`,
 * so CSS alone can't tell a column row apart without :has() (browser support) and
 * exact-nesting assumptions. This script tags:
 *   - each column item's wrapper `.builder-item`            -> .fw-pb-flex-col
 *   - the container that directly holds those items         -> .fw-pb-flex-row
 * flex-canvas.css then styles those classes. Re-runs on canvas DOM changes
 * (drag/drop, add/remove) via a debounced MutationObserver.
 *
 * Enqueued only when Bootstrap-3 Legacy Mode is OFF. Editor-only.
 */
( function () {
	'use strict';

	function rowHasFlexCol( container ) {
		var kids = container.children;
		for ( var i = 0; i < kids.length; i++ ) {
			if ( kids[ i ].classList && kids[ i ].classList.contains( 'fw-pb-flex-col' ) ) {
				return true;
			}
		}
		return false;
	}

	function retag( root ) {
		// Tag column items + their containing row.
		var cols = root.querySelectorAll( '.pb-item-type-column' );
		for ( var i = 0; i < cols.length; i++ ) {
			var item = cols[ i ].parentNode; // the .builder-item wrapper (cols[i] is its direct child)
			if ( ! item || ! item.classList || ! item.classList.contains( 'builder-item' ) ) {
				continue;
			}

			var container = item.parentNode; // the .builder-items container
			if ( ! container || ! container.classList || ! container.classList.contains( 'builder-items' ) ) {
				continue;
			}

			// Skip the ROOT container: it holds SECTION items, which are also
			// rendered with the `pb-item-type-column` class (e.g. `… custom-section`),
			// so they'd be mistaken for columns. Sections must keep stacking, so the
			// root row stays non-flex.
			if (
				container.parentNode && container.parentNode.classList &&
				container.parentNode.classList.contains( 'builder-root-items' )
			) {
				continue;
			}

			// Skip the masonry section — it packs its own columns into a CSS grid
			// (its editor styles.css/scripts.js). Flex tagging here would fight that
			// grid (equal-height stretch + a growing drop zone). Strip stale classes.
			if (
				container.parentNode && container.parentNode.classList &&
				container.parentNode.classList.contains( 'pb-section-like-masonry_section' )
			) {
				item.classList.remove( 'fw-pb-flex-col' );
				container.classList.remove( 'fw-pb-flex-row' );
				continue;
			}

			item.classList.add( 'fw-pb-flex-col' );
			container.classList.add( 'fw-pb-flex-row' );
		}

		// Drop the row class from containers that no longer hold a column item.
		var rows = root.querySelectorAll( '.fw-pb-flex-row' );
		for ( var j = 0; j < rows.length; j++ ) {
			if ( ! rowHasFlexCol( rows[ j ] ) ) {
				rows[ j ].classList.remove( 'fw-pb-flex-row' );
			}
		}
	}

	function init() {
		var builder = document.querySelector( '.fw-option-type-builder' );
		if ( ! builder ) { window.setTimeout( init, 300 ); return; }

		retag( builder );

		var pending = false;
		var observer = new MutationObserver( function () {
			if ( pending ) { return; }
			pending = true;
			window.setTimeout( function () {
				pending = false;
				retag( builder );
			}, 60 );
		} );
		observer.observe( builder, { childList: true, subtree: true } );
	}

	if ( document.readyState !== 'loading' ) {
		init();
	} else {
		document.addEventListener( 'DOMContentLoaded', init );
	}
} )();
