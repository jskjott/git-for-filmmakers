<template>
	<svg class="TreeGraph" :width="width"
:height="height">
		<circle
			v-for="d in circles"
			:cx="d.cx"
			:cy="d.cy"
			:r="d.r"
			:class="d.class"
		/>
		<line
			v-for="d in lines"
			:x1="d.x1"
			:y1="d.y1"
			:x2="d.x2"
			:y2="d.y2"
			:stroke="d.stroke"
		/>
		<text
			v-for="d in text"
			:x="d.x"
			:y="d.y"
			:dy="d.dy"
			:dx="d.dx"
			:class="d.class"
		>
			{{ d.text }}
		</text>
	</svg>
</template>

<script lang="ts">
import Vue from 'vue'

const width = 400
const blockHeight = 50
const interMargin = 5
const outerMargin = 40

export default Vue.extend({
	name: 'TreeGraph',
	props: {
		state: Object,
	},
	data() {
		return {
			width,
			height: 0,
			lines: [],
			circles: [],
			text: [],
		}
	},
	watch: {
		state: function() {
			if (this.state) {
				const commits = Object.values(this.state)

				commits.sort((a, b) => {
					return (
						a.logInfo.author.timestamp - b.logInfo.author.timestamp
					)
				})

				const timelineHeights = commits
					.map(commit => {
						const laneNumber =
							commit.timelineElements.reduce(
								(max, val) => (val.lane > max ? val.lane : max),
								0,
							) + 1

						return (
							outerMargin + laneNumber * blockHeight + interMargin
						)
					})
					.reverse()

				this.height = timelineHeights.reduce((acc, cur) => acc + cur, 0)

				let cumulative = 0

				commits.reverse().forEach((commit, i) => {
					const y1 = i === 0 ? 75 : cumulative
					const y2 =
						i === timelineHeights.length - 1
							? cumulative + timelineHeights[i] / 2
							: cumulative + timelineHeights[i]
					const stroke = 'silver'

					this.lines.push({
						x1: 150,
						y1,
						x2: 150,
						y2,
						stroke,
					})

					const cy = cumulative + timelineHeights[i] / 2

					this.circles.push({
						cx: 150,
						cy,
						r: 10,
						class: 'graphText',
					})

					const text = commit.logInfo.message

					this.text.push({
						x: 150,
						y: cy,
						dy: '.30em',
						dx: '2em',
						text,
						class: 'graphText',
					})

					cumulative = cumulative + timelineHeights[i]
				})
			}
		},
	},
})
</script>

<style scoped>
.graphText {
	fill: silver;
}
</style>
