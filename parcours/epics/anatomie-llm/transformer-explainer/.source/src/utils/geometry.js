/** Les générateurs amont ajoutent le scroll document ; annuler celui-ci à l'entrée. */
export function toDiagramRect(rect, origin, scrollX = 0, scrollY = 0) {
	return {
		left: rect.left - origin.left - scrollX,
		right: rect.right - origin.left - scrollX,
		top: rect.top - origin.top - scrollY,
		bottom: rect.bottom - origin.top - scrollY,
		width: rect.width,
		height: rect.height
	};
}
