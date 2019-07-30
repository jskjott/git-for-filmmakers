const d3 = require('d3')

function initRender(timelineData, scale) {
	timelineData.reverse().forEach((data, i) => {
		const laneNumber =
			d3.max(data, d => {
				return d.lane
			}) + 1

		const timelineHeight = 40 + laneNumber * 55

		const timeline = d3
			.select('#timeline')
			.append('svg')
			.attr('width', 800)
			.attr('height', timelineHeight)
			.style('background-color', '#1a161a')
			.attr('id', `svg-${i}`)

		Array.from(Array(parseInt(scale.max)).keys()).forEach(step => {
			if (step % 2 === 0) {
				timeline
					.append('line')
					.attr('x1', scale.offsetScale(step))
					.attr('y1', 0)
					.attr('x2', scale.offsetScale(step))
					.attr('y2', timelineHeight)
					.style(
						'stroke',
						d3.hsl({ h: 0, s: 0, l: 0.25, opacity: 0.5 }),
					)
			}
		})

		renderBlocks(data, i, scale, timelineHeight)
	})
}

function renderBlocks(blocks, i, scale, timelineHeight) {
	const svg = d3
		.select(`#svg-${i}`)
		.selectAll('rect')
		.data(blocks)

	svg.exit().remove()

	svg.enter()
		.append('rect')
		.attr('y', d => {
			return timelineHeight - (75 + (d.lane ? d.lane * 55 : 2.5))
		})
		.attr('height', 50)
		.attr('x', d => {
			return scale.offsetScale(
				d.lane === 0 ? d.offset - scale.min : d.offset,
			)
		})
		.attr('width', d => {
			return scale.offsetScale(d.duration)
		})
		.attr('fill', d => {
			return d3.hsl(d.color)
		})
		.attr('stroke', 'black')
}
