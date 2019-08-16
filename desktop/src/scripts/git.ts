const JsDiff = require('diff')
const fs = require('fs').promises
const fss = require('fs')
const git = require('isomorphic-git')
const xmldom = require('xmldom')
const signedXml = require('xml-crypto').SignedXml
const path = require('path');

const key = `-----BEGIN PRIVATE KEY-----
MIICdwIBADANBgkqhkiG9w0BAQEFAASCAmEwggJdAgEAAoGBAL4vpoH3H3byehjj
7RAGxefGRATiq4mXtzc9Q91W7uT0DTaFEbjzVch9aGsNjmLs4QHsoZbuoUmi0st4
x5z9SQpTAKC/dW8muzacT3E7dJJYh03MAO6RiH4LG34VRTq1SQN6qDt2rCK85eG4
5NHI4jceptZNu6Zot1zyO5/PYuFpAgMBAAECgYAhspeyF3M/xB7WIixy1oBiXMLY
isESFAumgfhwU2LotkVRD6rgNl1QtMe3kCNWa9pCWQcYkxeI0IzA+JmFu2shVvoR
oL7eV4VCe1Af33z24E46+cY5grxNhHt/LyCnZKcitvCcrzXExUc5n6KngX0mMKgk
W7skZDwsnKzhyUV8wQJBAN2bQMeASQVOqdfqBdFgC/NPnKY2cuDi6h659QN1l+kg
X3ywdZ7KKftJo1G9l45SN9YpkyEd9zEO6PMFaufJvZUCQQDbtAWxk0i8BT3UTNWC
T/9bUQROPcGZagwwnRFByX7gpmfkf1ImIvbWVXSpX68/IjbjSkTw1nj/Yj1NwFZ0
nxeFAkEAzPhRpXVBlPgaXkvlz7AfvY+wW4hXHyyi0YK8XdPBi25XA5SPZiylQfjt
Z6iN6qSfYqYXoPT/c0/QJR+orvVJNQJBANhRPNXljVTK2GDCseoXd/ZiI5ohxg+W
UaA/1fDvQsRQM7TQA4NXI7BO/YmSk4rW1jIeOxjiIspY4MFAIh+7UL0CQFL6zTg6
wfeMlEZzvgqwCGoLuvTnqtvyg45z7pfcrg2cHdgCXIy9kErcjwGiu6BOevEA1qTW
Rk+bv0tknWvcz/s=
-----END PRIVATE KEY-----`

function signXml(xml: string, xpath: string)
{
  const sig = new signedXml()
  sig.signingKey = key
  sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#"
  sig.addReference(xpath, ['http://www.w3.org/2001/10/xml-exc-c14n#'])
  const computed = sig.computeSignature(xml)
  return(sig.getOriginalXmlWithIds())
}

// readBranchFile & diff inspired by https://github.com/isomorphic-git/isomorphic-git/issues/193

interface RB {
	dir: string
	fs: any
}

export interface Commit {
	author: {
		email: string
		name: string
		timestamp: number
		timezoneOffset: number
	}
	committer: {
		email: string
		name: string
		timestamp: number
		timezoneOffset: number
	}
	message: string
	oid: string
	parent: string[]
	tree: string
}

export async function readBranchFile({ dir, fs }: RB) {
	const commitFiles = []

	const repoContent = await fs.readdir(dir)
	const xmlFileName = repoContent.filter((file: string) => {
		return file.match('.fcpxml')
	})

	const currentFileContent = await fs.readFile(
		`${dir}/${xmlFileName}`,
		'utf8',
	)

	commitFiles.push(currentFileContent)

	const log = [
		{
			message: 'current',
			author: {
				timestamp: Date.now(),
			},
		},
	]

	const commitInfo: Commit[] = await git.log({ fs, dir })
	log.push(...commitInfo)

	interface Entry {
		mode: number
		path: number
		oid: number
		type: number
	}

	interface File {
		format: string
		object: {
			entries: Entry[]
		}
		oid: string
		source: string
		type: string
	}

	const commitObjects: File[] = await Promise.all(
		commitInfo.map(commit =>
			git.readObject({ fs, dir, oid: commit.tree }),
		),
	)

	const fileContents: File[] = await Promise.all(
		commitObjects.map((commit) =>
			git.readObject({ fs, dir, oid: commit.object.entries[0].oid }),
		),
	)

	fileContents.forEach((file) => commitFiles.push(file.object.toString()))

	const commits = await Promise.all(
		commitFiles.map(commit => {
			const signed = signXml(commit, 
  "//*[local-name(.)='library']")
			return commit
		}),
	)

	const data = {
		commits,
		log,
	}
	return data
}

interface DiffInput{
	dir: string
	filepath: string
}

export function diff({ dir, filepath }: DiffInput) {
	let branchFile
	const fname = dir + '/' + filepath
	return fs
		.readFile(fname)
		.then(function(newFile: string) {
			return Promise.all([newFile, readBranchFile({ fs, dir })])
		})
		.then((data: any) => {
			branchFile = data[1].log
			const files = data[1].commits.reverse()
			const diffArray = files.map((file:string, i:number) => {
				if (i === 0) {
					return [file, []]
				} else {
					const diff = JsDiff.diffLines(files[i - 1], file)
					return [file, diff]
				}
			})

			return [diffArray, branchFile]
		})
}
