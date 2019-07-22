function parseFCPTimeSeconds(timeString) {
	const vals = timeString.split('/')
	let secondTiming
	if (vals.length === 1) {
		secondTiming = parseFloat(vals[0])
	} else {
		secondTiming = parseFloat(vals[0]) / parseFloat(vals[1])
	}
	return secondTiming
}

function timeline(timelineData) {
	class TimelineBlock {}

	const data = timelineData.map(clip => {
		const timelineBlock = {
			offset: parseFCPTimeSeconds(clip[0]),
			duration: parseFCPTimeSeconds(clip[1]),
			lane: parseInt(clip[2]),
		}
		return timelineBlock
	})

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

	d3.select('body')
		.append('svg')
		.attr('width', 1000)
		.attr('height', 500)
		.attr('id', 'svg')
	const svg = d3.select('svg')
	const rects = svg
		.selectAll('rect')
		.data(data)
		.enter()
		.append('rect')
		.attr('y', d => {
			return 50 + d.lane * 55
		})
		.attr('height', 50)
		.attr('x', d => {
			return offsetScale(d.lane === 0 ? d.offset - min : d.offset)
		})
		.attr('width', d => {
			return offsetScale(d.duration)
		})
}
