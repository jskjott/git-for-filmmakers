class Scale {
	constructor(data) {
		const flattenedData = data.flatMap(commit => commit)

		const lane0 = flattenedData.filter(d => d.lane === 0)

		this.lane0Transform = d3.min(lane0, d => {
			return d.offset
		})

		flattenedData.map(
			d =>
				(d.offset =
					d.lane === 0 ? d.offset - this.lane0Transform : d.offset),
		)

		this.min = d3.min(flattenedData, d => {
			return d.offset
		})
		this.max = d3.max(flattenedData, block => {
			return block.duration
		})
		const extent = d3.extent(flattenedData, d => {
			return d.offset
		})
		extent[1] = extent[1] + this.max

		extent.forEach((ele, i) => (extent[i] = ele - this.min))

		this.offsetScale = d3
			.scaleLinear()
			.domain(extent)
			.range([0, 800])
	}
}
