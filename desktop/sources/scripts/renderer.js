const d3 = require('d3')

function initRender(timelineData) {
	timelineData.reverse().forEach((data, i) => {
		const scales = getScales(data)

		d3.select('#timeline    ')
			.append('svg')
			.attr('width', 800)
			.attr('height', scales.timelineHeight)
			.attr('id', `svg-${i}`)

		renderBlocks(data, i, scales)
	})
}

function renderBlocks(blocks, i, scales) {
	const svg = d3
		.select(`#svg-${i}`)
		.selectAll('rect')
		.data(blocks)

	svg.exit().remove()

	svg.enter()
		.append('rect')
		.attr('y', d => {
			return scales.timelineHeight - (75 + (d.lane ? d.lane * 55 : 2.5))
		})
		.attr('height', 50)
		.attr('x', d => {
			return scales.offsetScale(
				d.lane === 0 ? d.offset - scales.min : d.offset,
			)
		})
		.attr('width', d => {
			return scales.offsetScale(d.duration)
		})
		.attr('fill', d => {
			return d3.hsl(d.color)
		})
		.attr('stroke', 'black')
}
