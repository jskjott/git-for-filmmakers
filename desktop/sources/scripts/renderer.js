const d3 = require('d3')

function initRender(timelineData, scale) {
	const timelineHeights = []
	timelineData.reverse().forEach((data, i) => {
		const laneNumber =
			d3.max(data, d => {
				return d.lane
			}) + 1

		const timelineHeight = 40 + laneNumber * 55
		timelineHeights.push(timelineHeight)

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

	return timelineHeights
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

function renderTree(branchFile, timelineHeights) {
	branchFile.sort((a, b) => {
		return a.author.timestamp - b.author.timestamp
	})

	branchFile.reverse().forEach((commit, i) => {
		const timeline = d3
			.select('#graph')
			.append('svg')
			.attr('width', 300)
			.attr('height', timelineHeights[i])
			.style('background-color', '#1f191f')
			.attr('id', `graph-${commit.oid}`)

		const y1 = i === 0 ? 75 : 0
		const y2 =
			i === timelineHeights.length - 1
				? timelineHeights[i] / 2
				: timelineHeights[i]

		timeline
			.append('line')
			.attr('x1', 150)
			.attr('y1', y1)
			.attr('x2', 150)
			.attr('y2', y2)
			.style('stroke', d3.hsl({ h: 0, s: 0, l: 0.25, opacity: 1 }))

		timeline
			.append('circle')
			.attr('cx', 150)
			.attr('cy', timelineHeights[i] / 2)
			.attr('r', 10)
			.style('fill', d3.hsl({ h: 0, s: 0, l: 0.25, opacity: 1 }))

		timeline
			.append('text')
			.attr('x', 150)
			.attr('y', timelineHeights[i] / 2)
			.attr('dy', '.30em')
			.attr('dx', '2em')
			.text(commit.message)
			.style('fill', 'dimgrey')
			.style('font-size', '14px')
	})
}
