<template>
	<div id="menu">
		<button @click="selectRepo(`12/124/24`)">Select Repo</button>
		<div v-if="currentRepo">
			{{ currentRepo.dir }}
		</div>
	</div>
</template>

<script lang="ts">
import Vue from 'vue'

export default Vue.extend({
	name: 'Menu',
	props: ['currentRepo'],
	data() {
		return {}
	},
	methods: {
		selectRepo() {
			this.$emit('selectRepo')
		},
	},
	mounted() {},
})
</script>

<style scoped>
@font-face {
	font-family: 'titillium_webbold';
	src: url('../assets/titilliumweb-bold-webfont.woff2') format('woff2'),
		url('../assets/titilliumweb-bold-webfont.woff') format('woff');
	font-weight: normal;
	font-style: normal;
}

@font-face {
	font-family: 'open_sansregular';
	src: url('../assets/opensans-regular-webfont.woff2') format('woff2'),
		url('../assets/opensans-regular-webfont.woff') format('woff');
	font-weight: normal;
	font-style: normal;
}

div {
	background-color: #252525;
	color: silver;
	padding: 0 0 0 2rem;
}

button {
	background-color: #717171;
	border-radius: 1rem;
	padding: 0.5rem;
	font-size: 20px;
	color: #343434;
	font-family: 'titillium_webbold';
}

#menu {
	display: grid;
	grid-template-columns: 1fr 6fr;
	align-items: center;
	width: 100%;
	height: 100px;
	background-color: #252525;
	padding: 0 2rem 0 7rem;
}
</style>
