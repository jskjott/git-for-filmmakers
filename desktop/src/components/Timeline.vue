<template>
	<svg class="Timeline" :width="width"
:height="height" v-if="scale">
		<line
			v-for="step in Array.from(Array(parseInt(scale.max)).keys())"
			:x1="scale.offsetScale(step)"
			y1="0"
			:x2="scale.offsetScale(step)"
			:y2="height"
			stroke="#333333"
		/>

		<rect
			v-for="d in blocks"
			:key="d.id"
			:x="d.x"
			:width="d.width"
			:y="d.y"
			:height="d.height"
			:fill="d.fill"
			:stroke="d.fill"
		/>
	</svg>
</template>

<script lang="ts">
import Vue from 'vue'
import { TimelineElement } from '../App.vue'

const blockHeight = 50
const interMargin = 5
const outerMargin = 40

interface Block {
	x: number
	y: number
	width: number
	height: number
	fill: string
}

const timelineHeight: number = blockHeight
const width = 800
const height = 200

let blocks: Block[]

const vue = Vue.extend({
	name: 'Timeline',
	props: ['commit', 'scale'],
	data() {
		return {
			width,
			height,
			blocks,
			timelineHeight,
		}
	},
	mounted() {
		const laneNumber =
			this.commit.timelineElements.reduce(
				(max: number, val: TimelineElement) =>
					val.lane > max ? val.lane : max,
				this.commit.timelineElements[0].lane,
			) + 1

		this.blocks = []

		this.height = outerMargin + laneNumber * blockHeight + interMargin

		this.commit.timelineElements.forEach((block: TimelineElement) => {
			const x = this.scale.offsetScale(
				block.lane === 0 ? block.offset - this.scale.min : block.offset,
			)
			const y =
				this.height -
				(75 +
					(block.lane
						? block.lane * (blockHeight + interMargin)
						: interMargin / 2))
			const width = this.scale.offsetScale(block.duration)
			const height = blockHeight
			const fill = block.color

			this.blocks.push({
				x,
				y,
				width,
				height,
				fill,
			})
		})
	},
})

export default vue
</script>

<style scoped="">
.Timeline {
	background-color: #1d1d1d;
}
</style>
