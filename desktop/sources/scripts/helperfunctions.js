function getScales(data) {
	const laneNumber =
		d3.max(data, d => {
			return d.lane
		}) + 1

	const lane0 = data.filter(d => d.lane === 0)
	const max = d3.max(lane0, block => {
		return block.duration
	})
	const min = d3.min(lane0, d => {
		return d.offset
	})
	const extent = d3.extent(lane0, d => {
		return d.offset
	})
	extent[1] = extent[1] + max
	extent.forEach((ele, i) => (extent[i] = ele - min))
	const offsetScale = d3
		.scaleLinear()
		.domain(extent)
		.range([0, 800])

	const timelineHeight = 40 + laneNumber * 55

	return { offsetScale, timelineHeight, min, max }
}
