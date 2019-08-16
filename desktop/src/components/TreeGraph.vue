<template>
	<svg class="TreeGraph" :width="width"
:height="height">
		<circle
			v-for="d in circles"
			:cx="d.cx"
			:cy="d.cy"
			:r="d.r"
			:class="d.classIndicator"
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
			:class="d.classIndicator"
		>
			{{ d.text }}
		</text>

		<text
			v-for="d in committers"
			:x="d.x"
			:y="d.y"
			:dy="d.dy"
			:dx="d.dx"
			:class="d.classIndicator"
		>
			{{ d.text }}
		</text>
	</svg>
</template>

<script lang="ts">
import Vue from 'vue'
import { State } from '../App.vue'

const width = 400
const blockHeight = 50
const interMargin = 5
const outerMargin = 40
const circleRadius = 10

interface Line {
	x1: number
	y1: number
	x2: number
	y2: number
	stroke: string
}

interface Circle {
	cx: number
	cy: number
	r: number
	classIndicator: string
}

interface Text {
	x: number
	y: number
	dy: string
	dx: string
	text: string
	classIndicator: string
}

const lines: Line[] = []
const circles: Circle[] = []
const text: Text[] = []
const committers: Text[] = []
const height = 0

export default Vue.extend({
	name: 'TreeGraph',
	props: {
		state: Object,
	},
	data() {
		return {
			width,
			height,
			lines,
			circles,
			text,
			committers,
		}
	},
	watch: {
		state: function() {
			if (this.state) {
				const commits: State[] = Object.values(this.state)

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
					const x1 = width / 2.5
					const x2 = width / 2.5
					const y1 = i === 0 ? 75 : cumulative
					const y2 =
						i === timelineHeights.length - 1
							? cumulative + timelineHeights[i] / 2
							: cumulative + timelineHeights[i]
					const stroke = 'silver'

					this.lines.push({
						x1,
						y1,
						x2,
						y2,
						stroke,
					})

					const cx = width / 2.5
					const cy = cumulative + timelineHeights[i] / 2
					const r = circleRadius
					const classIndicator = 'graphText'

					this.circles.push({
						cx,
						cy,
						r,
						classIndicator,
					})

					const x = width / 2.5
					const text = commit.logInfo.message
					const dy = '.30em'
					const dx = '2em'

					this.text.push({
						x,
						y: cy,
						dy,
						dx,
						text,
						classIndicator,
					})

					const committer = commit.logInfo.author.name
						? commit.logInfo.author.name
						: ''
					const leftTransform = 120
					const authorClass = 'author'

					this.committers.push({
						x: x - leftTransform,
						y: cy,
						dy,
						dx,
						text: committer,
						classIndicator: authorClass,
					})

					cumulative = cumulative + timelineHeights[i]
				})
			}
		},
	},
})
</script>

<style scoped>
.TreeGraph {
	background-color: #1d1d1d;
}

.graphText {
	fill: silver;
}

.author {
	fill: #525252;
}
</style>
