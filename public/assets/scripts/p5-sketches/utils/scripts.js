const scripts = {
	load: (src, async = true, type = 'text/javascript') => {
		return new Promise((resolve, reject) => {
			try {
				const scriptElement = document.createElement('script')
				const container = document.head || document.body

				scriptElement.type = type;
				scriptElement.async = async;
				scriptElement.src = src;

				scriptElement.addEventListener('load', () => {
					resolve({ status: true })
				})

				scriptElement.addEventListener('error', () => {
					reject({
						status: false,
						message: `Failed to load the script ${src}`
					})
				})

				container.appendChild(scriptElement)
			} catch (err) {
				reject(err)
			}
		})
	}
};

export default scripts;
