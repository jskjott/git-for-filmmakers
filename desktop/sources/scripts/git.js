const JsDiff = require('diff')
const fs = require('fs').promises
const git = require('isomorphic-git')

// readBranchFile & diff inspired by https://github.com/isomorphic-git/isomorphic-git/issues/193

async function readBranchFile({ dir, fs }) {
	const commitFiles = []

	const log = await git.log({ fs: fs, dir: dir })
	const commits = await Promise.all(
		log.map(commit => git.readObject({ fs, dir, oid: commit.tree })),
	)
	const fileContents = await Promise.all(
		commits.map(commit =>
			git.readObject({ fs, dir, oid: commit.object.entries[0].oid }),
		),
	)

	fileContents.forEach(file => commitFiles.push(file.object.toString('utf8')))

	return commitFiles
}

function diff({ dir, filepath }) {
	let fname = dir + '/' + filepath
	return fs
		.readFile(fname)
		.then(function(newFile) {
			return Promise.all([newFile, readBranchFile({ fs, dir })])
		})
		.then((data) => {
			const files = data[1].reverse()
			const diffArray = files.map((file, i) => {
				if (i === 0) {
					return [file, []]
				} else {
					const diff = JsDiff.structuredPatch(
						`${filepath}-${i - 1}`,
						`${filepath}-${i}`,
						files[i - 1],
						file,
					)
					return [file, diff]
				}
			})

			return diffArray
		})
}
